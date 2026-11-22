'use strict';
// PlanMark live updater.
// The app's own code (index.html, js/*.js, css, etc.) is published to the
// GitHub repo Steve-4523/Planmark- under app/, with app/manifest.json
// listing every file and its SHA-256. On launch and every 30 minutes the
// desktop app compares that manifest with what it has; changed files are
// downloaded (pinned to the exact commit, so CDN caching can't mix versions),
// verified, and staged into userData/live/<version>/. The page is told an
// update is ready and can reload; the next launch uses it automatically.
// Large libraries (pdf.js, OCR engine) stay bundled in the installer unless
// the manifest lists a newer copy.

const { app, net } = require('electron');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');

const OWNER = 'Steve-4523';
const REPO = 'Planmark-';
const BRANCH = 'main';
const PREFIX = 'app/';
// Poll often: GitHub answers an unchanged commit with 304 Not Modified, which does
// not count against the API rate limit, so a quick poll is free when nothing changed.
const CHECK_EVERY_MS = 20 * 1000;
const BACKOFF_MS = 5 * 60 * 1000;
let etag = null, lastSha = null, backoffUntil = 0;

let bundledRoot = null;
let liveRoot = null;
let active = null;          // { dir, version }
let onReady = () => {};
let checking = false;
let lastStatus = { state: 'idle' };

function sha256(buf) { return crypto.createHash('sha256').update(buf).digest('hex'); }
function cmpVer(a, b) {
  const pa = String(a || '0').split('.').map(Number), pb = String(b || '0').split('.').map(Number);
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) { const d = (pa[i] || 0) - (pb[i] || 0); if (d) return d; }
  return 0;
}
function readJson(p) { try { return JSON.parse(fs.readFileSync(p, 'utf8')); } catch (_) { return null; } }

// Where updates come from: config.json "update" ({type:'github',owner,repo,branch,prefix} or {type:'url',base}),
// overridable with the PLANMARK_UPDATE_BASE environment variable (used for testing).
function source() {
  if (process.env.PLANMARK_UPDATE_BASE) return { type: 'url', base: process.env.PLANMARK_UPDATE_BASE.replace(/\/+$/, '') };
  const live = active && readJson(path.join(active.dir, 'config.json'));
  const c = live || readJson(path.join(bundledRoot, 'config.json')) || {};
  const u = c.update || {};
  if (u.type === 'url' && u.base) return { type: 'url', base: String(u.base).replace(/\/+$/, '') };
  return { type: 'github', owner: u.owner || OWNER, repo: u.repo || REPO, branch: u.branch || BRANCH, prefix: u.prefix != null ? u.prefix : PREFIX };
}
function bundledVersion() { const m = readJson(path.join(bundledRoot, 'manifest.json')); return (m && m.version) || '0.0.0'; }
function currentVersion() { return active ? active.version : bundledVersion(); }

function init(webRoot, readyCb) {
  bundledRoot = webRoot;
  liveRoot = path.join(app.getPath('userData'), 'live');
  onReady = readyCb || onReady;
  const ptr = readJson(path.join(liveRoot, 'active.json'));
  if (ptr && ptr.dir && fs.existsSync(path.join(liveRoot, ptr.dir, 'manifest.json')) && cmpVer(ptr.version, bundledVersion()) > 0) {
    active = { dir: path.join(liveRoot, ptr.dir), version: ptr.version };
  }
  try { for (const d of fs.readdirSync(liveRoot)) if (d.startsWith('staging-')) fs.rmSync(path.join(liveRoot, d), { recursive: true, force: true }); } catch (_) {}
  setTimeout(check, 3000);
  setInterval(() => { if (Date.now() >= backoffUntil) check(); }, CHECK_EVERY_MS);
}

// Where to read a requested file from: the live update if it has it, else the bundle.
function resolve(rel) {
  if (active) {
    const p = path.normalize(path.join(active.dir, rel));
    if (p.startsWith(active.dir + path.sep) && fs.existsSync(p)) return p;
  }
  return null;
}

async function fetchBuf(url) {
  const r = await net.fetch(url, { headers: { 'User-Agent': 'PlanMark-Desktop', 'Cache-Control': 'no-cache' } });
  if (!r.ok) throw new Error(`HTTP ${r.status} for ${url}`);
  return Buffer.from(await r.arrayBuffer());
}

async function check(manual) {
  if (checking) return lastStatus;
  checking = true;
  let stageDir = null;
  try {
    lastStatus = { state: 'checking' };
    const src = source();
    let sha, raw, man;
    if (src.type === 'url') {
      man = JSON.parse((await fetchBuf(`${src.base}/manifest.json?t=${Date.now()}`)).toString('utf8'));
      sha = 'url' + String(man && man.version || '0').replace(/[^0-9a-z]/gi, '');
      raw = (p) => `${src.base}/${p}?v=${encodeURIComponent(man.version)}`;
    } else {
      const hdr = { 'User-Agent': 'PlanMark-Desktop', 'Accept': 'application/vnd.github.sha', 'Cache-Control': 'no-cache' };
      if (etag && lastSha && !manual) hdr['If-None-Match'] = etag;
      const r = await net.fetch(`https://api.github.com/repos/${src.owner}/${src.repo}/commits/${src.branch}`, { headers: hdr });
      if (r.status === 304) { if (lastStatus.state === 'checking') lastStatus = { state: 'up-to-date', version: currentVersion() }; return lastStatus; }
      if (r.status === 403 || r.status === 429) { backoffUntil = Date.now() + BACKOFF_MS; throw new Error(`GitHub rate limit (HTTP ${r.status}); retrying in 5 minutes`); }
      if (!r.ok) throw new Error(`HTTP ${r.status} checking for updates`);
      sha = (await r.text()).trim();
      if (!/^[0-9a-f]{40}$/.test(sha)) throw new Error('No commit found');
      etag = r.headers.get('etag'); lastSha = sha;
      raw = (p) => `https://raw.githubusercontent.com/${src.owner}/${src.repo}/${sha}/${src.prefix}${p}`;
      man = JSON.parse((await fetchBuf(raw('manifest.json'))).toString('utf8'));
    }
    if (!man || !man.version || !man.files) throw new Error('Bad manifest');
    if (man.minShell && cmpVer(app.getVersion(), man.minShell) < 0) {
      lastStatus = { state: 'shell-too-old', version: man.version, minShell: man.minShell };
      return lastStatus;
    }
    if (cmpVer(man.version, currentVersion()) <= 0) { lastStatus = { state: 'up-to-date', version: currentVersion() }; return lastStatus; }

    stageDir = path.join(liveRoot, 'staging-' + Date.now());
    fs.mkdirSync(stageDir, { recursive: true });
    for (const [rel, hash] of Object.entries(man.files)) {
      if (rel.includes('..')) continue;
      const dest = path.join(stageDir, rel);
      fs.mkdirSync(path.dirname(dest), { recursive: true });
      // Reuse an identical local copy (live or bundled) when we have one.
      const local = [active && path.join(active.dir, rel), path.join(bundledRoot, rel)].filter(Boolean).find(p => {
        try { return sha256(fs.readFileSync(p)) === hash; } catch (_) { return false; }
      });
      let buf = local ? fs.readFileSync(local) : await fetchBuf(raw(rel));
      if (sha256(buf) !== hash) throw new Error('Checksum mismatch for ' + rel);
      fs.writeFileSync(dest, buf);
    }
    fs.writeFileSync(path.join(stageDir, 'manifest.json'), JSON.stringify(man, null, 1));
    const dirName = 'v' + man.version.replace(/[^0-9a-z.\-]/gi, '_') + '-' + sha.slice(0, 8);
    const finalDir = path.join(liveRoot, dirName);
    fs.rmSync(finalDir, { recursive: true, force: true });
    fs.renameSync(stageDir, finalDir);
    stageDir = null;
    fs.writeFileSync(path.join(liveRoot, 'active.json'), JSON.stringify({ dir: dirName, version: man.version, commit: sha, at: Date.now() }));
    const old = active && active.dir;
    active = { dir: finalDir, version: man.version };
    // Clean up older versions (keep the one just replaced, in case a page still has it open).
    for (const d of fs.readdirSync(liveRoot)) {
      const full = path.join(liveRoot, d);
      if (full !== finalDir && full !== old && fs.statSync(full).isDirectory()) fs.rmSync(full, { recursive: true, force: true });
    }
    lastStatus = { state: 'ready', version: man.version, notes: man.notes || '' };
    onReady(lastStatus);
    return lastStatus;
  } catch (err) {
    if (stageDir) { try { fs.rmSync(stageDir, { recursive: true, force: true }); } catch (_) {} }
    lastStatus = { state: 'error', message: String(err && err.message || err), version: currentVersion() };
    return lastStatus;
  } finally {
    checking = false;
  }
}

module.exports = { init, resolve, check, currentVersion, status: () => lastStatus };
