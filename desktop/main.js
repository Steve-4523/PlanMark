'use strict';
// PlanMark desktop wrapper (Electron main process).
// Serves the bundled offline web app from ./web over a privileged custom
// scheme (app://planmark/) so Web Workers, fetch() and WASM work exactly as
// they do over http(s), which file:// would not allow.

const { app, BrowserWindow, protocol, session, shell, dialog, ipcMain, Menu, net } = require('electron');
const path = require('path');
const fs = require('fs');
const os = require('os');
const { execFile, spawn } = require('child_process');
const updater = require('./updater');

const SCHEME = 'app';
const HOST = 'planmark';
const ORIGIN = `${SCHEME}://${HOST}`;
const START_URL = `${ORIGIN}/index.html`;
const WEB_ROOT = path.join(__dirname, 'web');

// Must run before the app is ready.
protocol.registerSchemesAsPrivileged([
  {
    scheme: SCHEME,
    privileges: {
      standard: true,
      secure: true,
      supportFetchAPI: true,
      corsEnabled: true,
      stream: true,
      allowServiceWorkers: true,
    },
  },
]);

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.htm': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.cjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.map': 'application/json; charset=utf-8',
  '.wasm': 'application/wasm',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon',
  '.bmp': 'image/bmp',
  '.pdf': 'application/pdf',
  '.txt': 'text/plain; charset=utf-8',
  '.xml': 'application/xml',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf',
  '.otf': 'font/otf',
  '.bcmap': 'application/octet-stream',
  '.traineddata': 'application/octet-stream',
  '.gz': 'application/gzip',
  '.zip': 'application/zip',
  '.webmanifest': 'application/manifest+json',
};

function mimeFor(file) {
  return MIME[path.extname(file).toLowerCase()] || 'application/octet-stream';
}

function registerAppProtocol() {
  protocol.handle(SCHEME, async (request) => {
    try {
      const url = new URL(request.url);
      if (url.host !== HOST) return new Response('Not found', { status: 404 });
      let rel = decodeURIComponent(url.pathname);
      if (rel === '/' || rel === '') rel = '/index.html';
      const filePath = path.normalize(path.join(WEB_ROOT, rel));
      // Block path traversal outside the web root.
      if (filePath !== WEB_ROOT && !filePath.startsWith(WEB_ROOT + path.sep)) {
        return new Response('Forbidden', { status: 403 });
      }
      let target = updater.resolve(rel.replace(/^\/+/, '')) || filePath;
      const st = await fs.promises.stat(target).catch(() => null);
      if (st && st.isDirectory()) target = path.join(target, 'index.html');
      const data = await fs.promises.readFile(target);
      return new Response(data, {
        status: 200,
        headers: {
          'Content-Type': mimeFor(target),
          'Content-Length': String(data.length),
          'Access-Control-Allow-Origin': '*',
          'Cache-Control': 'no-cache',
          // Allows SharedArrayBuffer-free cross-origin isolation if ever needed;
          // harmless otherwise.
          'Cross-Origin-Resource-Policy': 'cross-origin',
        },
      });
    } catch (err) {
      return new Response('Not found', { status: 404, headers: { 'Content-Type': 'text/plain' } });
    }
  });
}

// ---------------------------------------------------------------------------
// Open-with / command-line PDF handling
// ---------------------------------------------------------------------------
let mainWindow = null;
let rendererReady = false; // page has called pmDesktop.onOpenFile(cb)
const pendingFiles = []; // [{name, bytes: Buffer}]

function pdfPathsFromArgv(argv, cwd) {
  const out = [];
  // Skip the executable itself (and the app path when running unpackaged: `electron .`).
  const args = argv.slice(app.isPackaged ? 1 : 2);
  for (const a of args) {
    if (!a || a.startsWith('-')) continue;
    if (!/\.pdf$/i.test(a)) continue;
    const p = path.resolve(cwd || process.cwd(), a);
    try {
      if (fs.statSync(p).isFile()) out.push(p);
    } catch (_) { /* ignore */ }
  }
  return out;
}

function queueFile(filePath) {
  try {
    const bytes = fs.readFileSync(filePath);
    pendingFiles.push({ name: path.basename(filePath), path: filePath, bytes });
    flushFiles();
  } catch (err) {
    dialog.showErrorBox('PlanMark', `Could not open file:\n${filePath}\n\n${err.message}`);
  }
}

function flushFiles() {
  if (!mainWindow || mainWindow.isDestroyed() || !rendererReady) return;
  while (pendingFiles.length) {
    const f = pendingFiles.shift();
    mainWindow.webContents.send('pm:open-file', { name: f.name, bytes: f.bytes, path: f.path || '' });
  }
}

function focusMainWindow() {
  if (!mainWindow || mainWindow.isDestroyed()) return;
  if (mainWindow.isMinimized()) mainWindow.restore();
  mainWindow.show();
  mainWindow.focus();
}

// ---------------------------------------------------------------------------
// Web tabs (<webview>): no preload, no Node, sandboxed, web pages only; links that open new windows stay in the tab.
app.on('web-contents-created', (_e, wc) => {
  wc.on('will-attach-webview', (event, webPreferences, params) => {
    delete webPreferences.preload;
    webPreferences.nodeIntegration = false;
    webPreferences.contextIsolation = true;
    webPreferences.sandbox = true;
    if (!/^(https?:|about:blank)/i.test(params.src || '')) event.preventDefault();
  });
  if (wc.getType && wc.getType() === 'webview') {
    wc.setWindowOpenHandler(({ url }) => { if (/^https?:/i.test(url)) wc.loadURL(url); return { action: 'deny' }; });
  }
});

// ---------------------------------------------------------------------------
// File locks: "~$<name>.pmlock" next to a PDF while it is open in PlanMark (like Office's owner files).
const heldLocks = new Set();
function lockFile(p) { return path.join(path.dirname(p), '~$' + path.basename(p) + '.pmlock'); }
function okPdf(p) { try { return typeof p === 'string' && /\.pdf$/i.test(p) && path.isAbsolute(p) && fs.statSync(p).isFile(); } catch (_) { return false; } }
function pidAlive(pid) { try { process.kill(pid, 0); return true; } catch (e) { return e.code === 'EPERM'; } }
function readLock(p) {
  const lf = lockFile(p);
  let L;
  try { L = JSON.parse(fs.readFileSync(lf, 'utf8')); } catch (_) { return null; }
  const host = os.hostname();
  L.mine = L.computer === host && L.pid === process.pid;
  L.stale = !L.time || Date.now() - L.time > 24 * 3600 * 1000 || (L.computer === host && L.pid !== process.pid && !pidAlive(L.pid));
  return L;
}
ipcMain.handle('pm:lock-check', (_e, p) => (okPdf(p) ? readLock(p) : null));
ipcMain.handle('pm:lock-acquire', (_e, p, user) => {
  if (!okPdf(p)) return { ok: false, reason: 'not a PDF on disk' };
  const L = { app: 'PlanMark', user: String(user || os.userInfo().username || 'Someone').slice(0, 80), computer: os.hostname(), pid: process.pid, time: Date.now() };
  try { fs.writeFileSync(lockFile(p), JSON.stringify(L)); heldLocks.add(p); return { ok: true }; } catch (err) { return { ok: false, reason: err.message }; }
});
function releaseLock(p) { const L = readLock(p); if (L && L.mine) { try { fs.unlinkSync(lockFile(p)); } catch (_) {} } heldLocks.delete(p); }
ipcMain.handle('pm:lock-release', (_e, p) => { if (typeof p === 'string') releaseLock(p); return true; });
app.on('will-quit', () => { for (const p of [...heldLocks]) releaseLock(p); });

// ---------------------------------------------------------------------------
// Email: Outlook (classic) can be started with an attachment; otherwise open the mail app and show the file.
function findOutlook() {
  return new Promise((resolve) => {
    if (process.platform !== 'win32') return resolve(null);
    execFile('reg', ['query', 'HKLM\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\App Paths\\OUTLOOK.EXE', '/ve'], { windowsHide: true }, (err, out) => {
      if (err) return resolve(null);
      const m = String(out).match(/REG_SZ\s+(.+\.exe)/i);
      const exe = m && m[1].trim().replace(/^"|"$/g, '');
      resolve(exe && fs.existsSync(exe) ? exe : null);
    });
  });
}
ipcMain.handle('pm:email', async (_e, o = {}) => {
  const dir = path.join(os.tmpdir(), 'PlanMark-email');
  fs.mkdirSync(dir, { recursive: true });
  const name = String(o.name || 'document.pdf').replace(/[\\/:*?"<>|]+/g, '_').slice(0, 150);
  const file = path.join(dir, name);
  fs.writeFileSync(file, Buffer.from(o.bytes || []));
  const enc = encodeURIComponent;
  const q = `subject=${enc(o.subject || '')}&body=${enc(o.body || '')}`;
  const testing = !!process.env.PM_TEST_NO_EXTERNAL;
  const outlook = await findOutlook();
  if (outlook) {
    if (!testing) spawn(outlook, ['/c', 'ipm.note', '/m', `${o.to || ''}?${q}`, '/a', file], { detached: true, stdio: 'ignore', windowsHide: false }).unref();
    return { method: 'outlook', path: file };
  }
  if (!testing) { shell.showItemInFolder(file); await shell.openExternal(`mailto:${o.to || ''}?${q}`); }
  return { method: 'mailto', path: file };
});

ipcMain.on('pm:version', (e) => { e.returnValue = app.getVersion(); });
ipcMain.on('pm:web-version', (e) => { e.returnValue = updater.currentVersion(); });
ipcMain.handle('pm:check-update', () => updater.check(true));
// Printing: the page renders each sheet to an image; we lay them out one per printed page and open the system print dialog.
ipcMain.handle('pm:print-images', async (e, pages) => {
  if (!Array.isArray(pages) || !pages.length) return { ok: false, reason: 'nothing to print' };
  const css = pages.map((p, i) => `@page p${i}{size:${(+p.wIn).toFixed(3)}in ${(+p.hIn).toFixed(3)}in;margin:0} .p${i}{page:p${i};width:${(+p.wIn).toFixed(3)}in;height:${(+p.hIn).toFixed(3)}in}`).join('\n');
  const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><style>html,body{margin:0;padding:0}div{break-after:page;overflow:hidden}img{width:100%;height:100%;display:block;object-fit:contain}${css}</style></head><body>${pages.map((p, i) => `<div class="p${i}"><img src="${String(p.dataUrl).replace(/"/g, '')}"></div>`).join('')}</body></html>`;
  const tmp = path.join(app.getPath('temp'), `planmark-print-${Date.now()}.html`);
  fs.writeFileSync(tmp, html);
  const parent = BrowserWindow.fromWebContents(e.sender);
  const win = new BrowserWindow({ show: false, parent, webPreferences: { sandbox: true, contextIsolation: true } });
  try {
    await win.loadFile(tmp);
    return await new Promise((resolve) => {
      win.webContents.print({ silent: false, printBackground: true, margins: { marginType: 'none' } }, (ok, reason) => resolve({ ok, reason: ok ? '' : (reason || 'cancelled') }));
    });
  } finally { setTimeout(() => { try { win.destroy(); fs.unlinkSync(tmp); } catch (_) {} }, 1500); }
});
// Quantity Link: the user picks an .xlsx once (Save dialog); later rewrites are only allowed to files picked that way.
const linkedStore = () => path.join(app.getPath('userData'), 'linked-files.json');
const linkedPaths = () => { try { return new Set(JSON.parse(fs.readFileSync(linkedStore(), 'utf8'))); } catch (_) { return new Set(); } };
ipcMain.handle('pm:save-linked', async (e, opt = {}) => {
  const parent = BrowserWindow.fromWebContents(e.sender);
  const name = String(opt.name || 'quantities.xlsx').replace(/[\\/:*?"<>|]/g, '_');
  const r = await dialog.showSaveDialog(parent, { title: 'Link quantities to an Excel file', defaultPath: path.join(app.getPath('documents'), name), filters: [{ name: 'Excel workbook', extensions: ['xlsx'] }] });
  if (r.canceled || !r.filePath) return { path: null };
  let p = r.filePath; if (!/\.xlsx$/i.test(p)) p += '.xlsx';
  fs.writeFileSync(p, Buffer.from(opt.bytes || []));
  const set = linkedPaths(); set.add(p); fs.writeFileSync(linkedStore(), JSON.stringify([...set]));
  return { path: p };
});
ipcMain.handle('pm:write-linked', async (_e, p, bytes) => {
  if (typeof p !== 'string' || !/\.xlsx$/i.test(p) || !linkedPaths().has(p)) return { ok: false, reason: 'not a linked file' };
  try { const tmp = p + '.planmark-tmp'; fs.writeFileSync(tmp, Buffer.from(bytes || [])); fs.renameSync(tmp, p); return { ok: true }; }
  catch (err) { return { ok: false, reason: /EBUSY|EPERM/.test(err.code || '') ? 'the file is open and locked in Excel — close it or use Data > Refresh' : err.message }; }
});
// RFC 3161 time-stamp requests for digital signatures (POST to the chosen time-stamp server).
ipcMain.handle('pm:tsa', async (_e, url, query) => {
  if (typeof url !== 'string' || !/^https?:\/\//i.test(url)) throw new Error('Invalid time-stamp server address');
  const r = await net.fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/timestamp-query' }, body: Buffer.from(query || []) });
  if (!r.ok) throw new Error('Time-stamp server replied ' + r.status);
  return new Uint8Array(await r.arrayBuffer());
});
// Open another window (e.g. for a second monitor), optionally with a document.
const extraPending = new Map(); // webContents id -> [{name, bytes}]
ipcMain.handle('pm:new-window', (_e, file) => {
  const w = createWindow(true);
  if (file && file.bytes) extraPending.set(w.webContents.id, [{ name: String(file.name || 'document.pdf'), bytes: Buffer.from(file.bytes) }]);
  return true;
});
// Network bridge for account sign-in / settings sync: the Olympia account server (Supabase auth + REST)
// and, for older configs, Google identity & Firestore. PM_TEST_FETCH_BASE allows a local test server.
const ALLOWED_FETCH = /^https:\/\/([a-z0-9]{20}\.supabase\.co\/(auth|rest)\/v1\/|(identitytoolkit|securetoken|firestore)\.googleapis\.com\/)/;
const TEST_FETCH = process.env.PM_TEST_FETCH_BASE || '';
ipcMain.handle('pm:fetch', async (_e, url, opt = {}) => {
  if (typeof url !== 'string' || !(ALLOWED_FETCH.test(url) || (TEST_FETCH && url.startsWith(TEST_FETCH)))) return { status: 0, body: '{"error":{"message":"blocked"}}' };
  try {
    const r = await net.fetch(url, { method: opt.method || 'GET', headers: opt.headers || {}, body: opt.body || undefined });
    return { status: r.status, body: await r.text() };
  } catch (err) { return { status: 0, body: JSON.stringify({ error: { message: 'Failed to fetch: ' + err.message } }) }; }
});
ipcMain.on('pm:reload', (e) => { try { e.sender.reloadIgnoringCache(); } catch (_) {} });
ipcMain.on('pm:ready', (e) => {
  if (mainWindow && e.sender === mainWindow.webContents) {
    rendererReady = true;
    flushFiles();
  } else {
    const q = extraPending.get(e.sender.id);
    if (q) { extraPending.delete(e.sender.id); for (const f of q) e.sender.send('pm:open-file', f); }
  }
});

// ---------------------------------------------------------------------------
// Window
// ---------------------------------------------------------------------------
function isExternalUrl(u) {
  return /^(https?:|mailto:|tel:)/i.test(u);
}

function createWindow(extra) {
  const win = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 800,
    minHeight: 500,
    title: 'PlanMark',
    show: false,
    autoHideMenuBar: true,
    backgroundColor: '#ffffff',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      spellcheck: false,
      webviewTag: true,
    },
  });

  if (!extra) mainWindow = win;
  win.once('ready-to-show', () => {
    win.maximize();
    win.show();
  });

  // Keep the window title "PlanMark" unless the page sets a meaningful one.
  win.on('page-title-updated', (e, title) => {
    if (!title || /^app:\/\//i.test(title) || /index\.html$/i.test(title)) {
      e.preventDefault();
      win.setTitle('PlanMark');
    }
  });

  const wc = win.webContents;

  // A new page load means the callback must be registered again.
  wc.on('did-start-navigation', (details) => {
    if (details.isMainFrame && !details.isSameDocument && !extra) rendererReady = false;
  });

  // DevTools: Ctrl+Shift+I / F12. Everything else goes to the page untouched.
  wc.on('before-input-event', (event, input) => {
    if (input.type !== 'keyDown') return;
    const key = (input.key || '').toLowerCase();
    if ((input.control || input.meta) && input.shift && key === 'i') {
      wc.toggleDevTools();
      event.preventDefault();
    } else if (key === 'f12') {
      wc.toggleDevTools();
      event.preventDefault();
    }
  });

  // External links -> default browser. blob:/app: popups (e.g. previews) stay in-app.
  wc.setWindowOpenHandler(({ url }) => {
    if (isExternalUrl(url)) {
      shell.openExternal(url);
      return { action: 'deny' };
    }
    if (url.startsWith(ORIGIN) || url.startsWith('blob:') || url === 'about:blank') {
      return {
        action: 'allow',
        overrideBrowserWindowOptions: {
          autoHideMenuBar: true,
          webPreferences: { contextIsolation: true, nodeIntegration: false, sandbox: true },
        },
      };
    }
    return { action: 'deny' };
  });

  wc.on('will-navigate', (event, url) => {
    if (!url.startsWith(ORIGIN)) {
      event.preventDefault();
      if (isExternalUrl(url)) shell.openExternal(url);
    }
  });

  // Page used beforeunload to warn about unsaved changes: Electron would
  // silently cancel the close, so ask the user instead.
  wc.on('will-prevent-unload', (event) => {
    const choice = dialog.showMessageBoxSync(win, {
      type: 'question',
      buttons: ['Leave', 'Stay'],
      defaultId: 1,
      cancelId: 1,
      title: 'PlanMark',
      message: 'You may have unsaved changes.',
      detail: 'Are you sure you want to close PlanMark?',
    });
    if (choice === 0) event.preventDefault(); // preventDefault here = ignore beforeunload, proceed
  });

  win.on('closed', () => {
    if (win === mainWindow) {
      rendererReady = false;
      const others = BrowserWindow.getAllWindows().filter(w => w !== win && !w.isDestroyed() && !w.getParentWindow());
      mainWindow = others[0] || null;
      if (mainWindow) rendererReady = true;
    }
  });

  win.loadURL(START_URL);
  return win;
}

function setupDownloads() {
  session.defaultSession.on('will-download', (event, item) => {
    const name = item.getFilename() || 'download';
    const ext = path.extname(name).replace('.', '').toLowerCase();
    const filters = [];
    if (ext) filters.push({ name: `${ext.toUpperCase()} file`, extensions: [ext] });
    filters.push({ name: 'All files', extensions: ['*'] });
    // Not calling setSavePath() makes Electron show the native Save As dialog
    // using these options.
    item.setSaveDialogOptions({
      title: 'Save As',
      defaultPath: path.join(app.getPath('documents'), name),
      filters,
    });
  });
}

// ---------------------------------------------------------------------------
// App lifecycle
// ---------------------------------------------------------------------------
const gotLock = app.requestSingleInstanceLock();
if (!gotLock) {
  app.quit();
} else {
  app.on('second-instance', (_event, argv, workingDirectory) => {
    for (const p of pdfPathsFromArgv(argv, workingDirectory)) queueFile(p);
    if (mainWindow) focusMainWindow();
    else if (app.isReady()) createWindow();
  });

  // macOS Finder "Open With" (harmless elsewhere).
  app.on('open-file', (event, filePath) => {
    event.preventDefault();
    if (app.isReady()) { queueFile(filePath); focusMainWindow(); }
    else app.whenReady().then(() => queueFile(filePath));
  });

  app.whenReady().then(() => {
    // No application menu: no accelerators steal Ctrl+S / Ctrl+O / Ctrl+Z etc.
    Menu.setApplicationMenu(null);
    registerAppProtocol();
    app.on('browser-window-focus', () => { try { updater.check(); } catch (_) {} });
    updater.init(WEB_ROOT, (st) => { for (const w of BrowserWindow.getAllWindows()) if (!w.isDestroyed()) w.webContents.send('pm:update-ready', st); });
    setupDownloads();
    createWindow();
    for (const p of pdfPathsFromArgv(process.argv, process.cwd())) queueFile(p);

    app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0) createWindow();
    });
  });

  app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') app.quit();
  });
}
