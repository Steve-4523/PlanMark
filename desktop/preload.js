'use strict';
// Exposes a minimal, safe desktop API to the page as window.pmDesktop.
const { contextBridge, ipcRenderer, webUtils } = require('electron');

let version = '';
try { version = ipcRenderer.sendSync('pm:version') || ''; } catch (_) { /* ignore */ }

const callbacks = [];
let listening = false;

function toUint8(bytes) {
  if (bytes instanceof Uint8Array) return new Uint8Array(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  if (bytes instanceof ArrayBuffer) return new Uint8Array(bytes);
  if (bytes && bytes.data) return Uint8Array.from(bytes.data);
  return new Uint8Array(0);
}

let webVersion = '';
try { webVersion = ipcRenderer.sendSync('pm:web-version') || ''; } catch (_) { /* ignore */ }

contextBridge.exposeInMainWorld('pmDesktop', {
  isDesktop: true,
  version,
  webVersion,
  /** cb({state:'ready', version, notes}) when a downloaded update is ready to load. */
  onUpdateReady(cb) { if (typeof cb === 'function') ipcRenderer.on('pm:update-ready', (_e, st) => { try { cb(st); } catch (err) { console.error(err); } }); },
  /** Check now. Resolves {state: 'up-to-date'|'ready'|'error'|'shell-too-old', version, ...}. */
  checkForUpdates() { return ipcRenderer.invoke('pm:check-update'); },
  /** Reload the app window (picks up a downloaded update). */
  reload() { ipcRenderer.send('pm:reload'); },
  /** Sign-in/sync requests to Google identity & Firestore, made from the main process. */
  netFetch(url, opt) { return ipcRenderer.invoke('pm:fetch', url, opt || {}); },
  /** Print pages: [{dataUrl, wIn, hIn}] → opens the Windows print dialog. Resolves {ok, reason}. */
  printImages(pages) { return ipcRenderer.invoke('pm:print-images', pages); },
  /** Quantity Link: pick an .xlsx with a Save dialog and write it. Resolves {path} (null if cancelled). */
  saveLinkedFile(opt) { return ipcRenderer.invoke('pm:save-linked', { name: opt && opt.name, bytes: opt && opt.bytes }); },
  /** Rewrite a previously linked .xlsx. Resolves {ok, reason}. */
  writeLinkedFile(p, bytes) { return ipcRenderer.invoke('pm:write-linked', p, bytes); },
  /** Send an RFC 3161 time-stamp query; resolves the DER response bytes. */
  tsaRequest(url, query) { return ipcRenderer.invoke('pm:tsa', url, query); },
  /** Open a new PlanMark window, optionally showing a document ({name, bytes}). */
  /** Full path of a File picked in an <input type=file> ('' if unknown). */
  pathForFile(file) { try { return webUtils.getPathForFile(file) || ''; } catch (_) { return ''; } },
  /** File locks: check / take / release the "~$name.pmlock" owner file next to a PDF. */
  lockCheck(p) { return ipcRenderer.invoke('pm:lock-check', p); },
  lockAcquire(p, user) { return ipcRenderer.invoke('pm:lock-acquire', p, user); },
  lockRelease(p) { return ipcRenderer.invoke('pm:lock-release', p); },
  /** Email a PDF: {name, bytes, to, subject, body} → {method:'outlook'|'mailto', path}. */
  emailFile(o) { return ipcRenderer.invoke('pm:email', { name: o && o.name, bytes: o && o.bytes, to: o && o.to, subject: o && o.subject, body: o && o.body }); },
  newWindow(file) { return ipcRenderer.invoke('pm:new-window', file ? { name: file.name, bytes: file.bytes } : null); },
  /**
   * Register a handler for PDFs opened via "Open with", the command line, or a
   * second launch. cb({ name: string, bytes: Uint8Array }). A file passed at
   * launch is buffered in the main process and delivered as soon as the first
   * callback is registered.
   */
  onOpenFile(cb) {
    if (typeof cb !== 'function') return;
    callbacks.push(cb);
    if (!listening) {
      listening = true;
      ipcRenderer.on('pm:open-file', (_event, file) => {
        const payload = { name: String(file && file.name || 'document.pdf'), bytes: toUint8(file && file.bytes), path: String(file && file.path || '') };
        for (const fn of callbacks) {
          try { fn(payload); } catch (err) { console.error('pmDesktop.onOpenFile callback failed', err); }
        }
      });
    }
    ipcRenderer.send('pm:ready');
  },
});
