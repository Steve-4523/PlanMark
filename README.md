# PlanMark

PDF markup and takeoff app for Olympia Holdings (web + Windows desktop).

- `app/` — the live app files. The Windows app checks `app/manifest.json` every 30 minutes and on launch; any file whose SHA-256 matches the manifest is installed automatically. Files that don't match are rejected.
- `desktop/` — source for the Windows shell (Electron) and its updater.

To release an update: change files in `app/`, regenerate `app/manifest.json` with a higher version, and push to `main`.
