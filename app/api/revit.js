/* PlanMark — open Revit (.rvt) files through Autodesk Platform Services (Model Derivative API).
   The Autodesk keys live only here, as Vercel environment variables APS_CLIENT_ID / APS_CLIENT_SECRET.
   Only people signed in with their Olympia account can use it (their sign-in is checked with Supabase).

   GET  ?a=status&key=<sha256>.rvt        -> {state, progress, views:[{name,urn}], ifc}
   POST ?a=upload  {key,size}             -> {uploadKey, partSize, urls[]}   (browser PUTs the parts straight to Autodesk storage)
   POST ?a=finish  {key,uploadKey}        -> starts the conversion
   GET  ?a=file&key=..&deriv=..&start=&end= -> up to 4 MB of a converted file (sheet PDF or IFC model) */
'use strict';
const APS = 'https://developer.api.autodesk.com';
const CHUNK_MAX = 4 * 1024 * 1024;
const ORIGINS = [/^https:\/\/planmark\.olympiaholdings\.com$/, /^app:\/\/planmark$/, /^https:\/\/planmark-[a-z0-9-]+\.vercel\.app$/];
const SUPA = 'https://nsolglpjijgitslovxah.supabase.co';
const SUPA_ANON = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5zb2xnbHBqaWpnaXRzbG92eGFoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTE3NDE3MDksImV4cCI6MjEwNzMxNzcwOX0.lRI-pW0sHAzrG9GzvgrIN-8DP_QsM-S38yU6b2NbkZw';

let tok = null, tokExp = 0, bucketOk = false;
async function apsToken() {
  if (tok && Date.now() < tokExp) return tok;
  const id = process.env.APS_CLIENT_ID, secret = process.env.APS_CLIENT_SECRET;
  if (!id || !secret) throw Object.assign(new Error('Revit opening is not set up yet (Autodesk keys missing).'), { status: 503 });
  const r = await fetch(APS + '/authentication/v2/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded', Authorization: 'Basic ' + Buffer.from(id + ':' + secret).toString('base64') },
    body: 'grant_type=client_credentials&scope=' + encodeURIComponent('data:read data:write data:create bucket:read bucket:create'),
  });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw Object.assign(new Error('Autodesk refused the keys: ' + (j.errorCode || j.developerMessage || r.status)), { status: 502 });
  tok = j.access_token; tokExp = Date.now() + (j.expires_in - 120) * 1000;
  return tok;
}
const bucket = () => ('planmark-' + String(process.env.APS_CLIENT_ID || '').toLowerCase().replace(/[^a-z0-9]/g, '')).slice(0, 60);
const objUrn = key => 'urn:adsk.objects:os.object:' + bucket() + '/' + key;
const b64u = s => Buffer.from(s).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');

async function aps(path, opt = {}) {
  const t = await apsToken();
  const r = await fetch(APS + path, { ...opt, headers: { Authorization: 'Bearer ' + t, ...(opt.body && typeof opt.body === 'string' ? { 'Content-Type': 'application/json' } : {}), ...(opt.headers || {}) } });
  return r;
}
async function apsJson(path, opt) {
  const r = await aps(path, opt);
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw Object.assign(new Error('Autodesk: ' + (j.reason || j.diagnostic || j.developerMessage || j.errorCode || r.status)), { status: r.status === 404 ? 404 : 502 });
  return j;
}
async function ensureBucket() {
  if (bucketOk) return;
  const r = await aps('/oss/v2/buckets', { method: 'POST', headers: { 'x-ads-region': 'US' }, body: JSON.stringify({ bucketKey: bucket(), policyKey: 'transient' }) });
  if (!r.ok && r.status !== 409) { const j = await r.json().catch(() => ({})); throw Object.assign(new Error('Autodesk storage: ' + (j.reason || r.status)), { status: 502 }); }
  bucketOk = true;
}

async function signedIn(req) {
  const h = req.headers.authorization || '';
  if (!/^Bearer \S+/.test(h)) return false;
  const r = await fetch(SUPA + '/auth/v1/user', { headers: { apikey: SUPA_ANON, Authorization: h } });
  return r.ok;
}

/* Collect the converted sheets/views (PDF per 2D view) and the IFC model from the manifest. */
function readManifest(m) {
  const views = [], ifcs = [];
  const walk = (n, view) => {
    if (!n || typeof n !== 'object') return;
    if (n.type === 'geometry' && n.role === '2d') view = { name: n.name || 'View', guid: n.guid };
    if (n.role === 'pdf-page' && n.urn && view) views.push({ name: view.name, urn: n.urn });
    if (n.urn && /\.ifc$/i.test(n.urn)) ifcs.push(n.urn);
    (n.children || []).forEach(c => walk(c, view));
  };
  (m.derivatives || []).forEach(d => walk(d, null));
  const seen = new Set();
  return { views: views.filter(v => !seen.has(v.urn) && seen.add(v.urn)), ifc: ifcs[0] || null };
}
function overall(m) {
  // The manifest is "success" only when every output finished; report the PDF/IFC parts separately.
  const st = { status: m.status, progress: m.progress };
  for (const d of m.derivatives || []) st[d.outputType] = d.status;
  return st;
}

const validKey = k => /^[a-f0-9]{64}\.(rvt|rfa|rte)$/.test(k || '');
const validDeriv = d => /^urn:adsk\.viewing:fs\.file:[A-Za-z0-9_=-]+\/output\/[^\s?#]{1,400}$/.test(d || '');

async function body(req) {
  if (req.body && typeof req.body === 'object') return req.body;
  if (typeof req.body === 'string') return JSON.parse(req.body || '{}');
  const chunks = []; for await (const c of req) chunks.push(c);
  return JSON.parse(Buffer.concat(chunks).toString() || '{}');
}

module.exports = async (req, res) => {
  const origin = req.headers.origin || '';
  if (ORIGINS.some(re => re.test(origin))) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Vary', 'Origin');
    res.setHeader('Access-Control-Allow-Headers', 'Authorization, Content-Type');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Expose-Headers', 'Content-Range, X-Total-Length');
  }
  if (req.method === 'OPTIONS') return res.status(204).end();
  res.setHeader('Cache-Control', 'no-store');
  try {
    if (!(await signedIn(req))) return res.status(401).json({ error: 'Sign in with your Olympia account to open Revit files.' });
    const q = req.query || {};
    const a = q.a;
    if (a === 'status') {
      if (!validKey(q.key)) return res.status(400).json({ error: 'bad key' });
      const r = await aps('/modelderivative/v2/designdata/' + b64u(objUrn(q.key)) + '/manifest');
      if (r.status === 404) return res.json({ state: 'none' });
      const m = await r.json();
      if (!r.ok) throw Object.assign(new Error('Autodesk: ' + (m.diagnostic || r.status)), { status: 502 });
      const got = readManifest(m), st = overall(m);
      const msgs = [];
      (function walk(n) { if (!n || typeof n !== 'object') return; (n.messages || []).forEach(x => x && x.message && msgs.push(String(x.message).slice(0, 300))); (n.derivatives || n.children || []).forEach(walk); })(m);
      return res.json({ state: m.status, progress: m.progress, outputs: st, views: got.views, ifc: got.ifc, messages: [...new Set(msgs)].slice(0, 5) });
    }
    if (a === 'upload' && req.method === 'POST') {
      const b = await body(req);
      if (!validKey(b.key) || !(b.size > 0)) return res.status(400).json({ error: 'bad request' });
      if (b.size > 2 * 1024 * 1024 * 1024) return res.status(413).json({ error: 'That file is over 2 GB.' });
      await ensureBucket();
      const partSize = Math.max(8 * 1024 * 1024, Math.ceil(b.size / 25 / 1048576) * 1048576);
      const parts = Math.max(1, Math.ceil(b.size / partSize));
      const j = await apsJson('/oss/v2/buckets/' + bucket() + '/objects/' + encodeURIComponent(b.key) + '/signeds3upload?parts=' + parts + '&minutesExpiration=60');
      return res.json({ uploadKey: j.uploadKey, urls: j.urls, partSize });
    }
    if (a === 'finish' && req.method === 'POST') {
      const b = await body(req);
      if (!validKey(b.key) || !b.uploadKey) return res.status(400).json({ error: 'bad request' });
      await apsJson('/oss/v2/buckets/' + bucket() + '/objects/' + encodeURIComponent(b.key) + '/signeds3upload', { method: 'POST', body: JSON.stringify({ uploadKey: String(b.uploadKey) }) });
      const job = {
        input: { urn: b64u(objUrn(b.key)) },
        output: { destination: { region: 'us' }, formats: [{ type: 'svf2', views: ['2d', '3d'], advanced: { '2dviews': 'pdf' } }, { type: 'ifc' }] },
      };
      const j = await apsJson('/modelderivative/v2/designdata/job', { method: 'POST', headers: { 'x-ads-force': 'true' }, body: JSON.stringify(job) });
      return res.json({ ok: true, result: j.result });
    }
    if (a === 'file') {
      if (!validKey(q.key) || !validDeriv(q.deriv)) return res.status(400).json({ error: 'bad request' });
      const start = Math.max(0, parseInt(q.start, 10) || 0);
      const end = Math.min(start + CHUNK_MAX - 1, parseInt(q.end, 10) || start + CHUNK_MAX - 1);
      const sr = await aps('/modelderivative/v2/designdata/' + b64u(objUrn(q.key)) + '/manifest/' + encodeURIComponent(q.deriv) + '/signedcookies?minutesExpiration=10');
      const sj = await sr.json().catch(() => ({}));
      if (!sr.ok || !sj.url) throw Object.assign(new Error('Autodesk download: ' + (sj.diagnostic || sr.status)), { status: 502 });
      const cookies = (typeof sr.headers.getSetCookie === 'function' ? sr.headers.getSetCookie() : [sr.headers.get('set-cookie') || '']).map(c => c.split(';')[0]).filter(Boolean).join('; ');
      const fr = await fetch(sj.url, { headers: { Cookie: cookies, Range: 'bytes=' + start + '-' + end } });
      if (!fr.ok) return res.status(502).json({ error: 'Autodesk download failed (' + fr.status + ')' });
      const buf = Buffer.from(await fr.arrayBuffer());
      const total = (fr.headers.get('content-range') || '').split('/')[1] || (fr.status === 200 ? String(buf.length) : (sj.size != null ? String(sj.size) : ''));
      res.setHeader('Content-Type', 'application/octet-stream');
      res.setHeader('X-Total-Length', total);
      // A plain 200 (no range support) returns the whole file at once; send at most one chunk of it.
      const out = fr.status === 200 ? buf.subarray(start, end + 1) : buf;
      return res.status(200).send(out);
    }
    return res.status(400).json({ error: 'unknown action' });
  } catch (e) {
    return res.status(e.status || 500).json({ error: e.message || String(e) });
  }
};
