# PlanMark

PDF markup and takeoff app for Olympia Holdings (web + Windows desktop).

- `app/` — the live app files. The Windows app checks `app/manifest.json` every 20 seconds (and whenever the window is focused); the update is applied automatically as soon as the user pauses; any file whose SHA-256 matches the manifest is installed automatically. Files that don't match are rejected.
- `desktop/` — source for the Windows shell (Electron) and its updater.

To release an update: change files in `app/`, regenerate `app/manifest.json` with a higher version, and push to `main`.

## Website
`app/` is also the website (planmark.olympiaholdings.com): Cloudflare Pages serves this folder as-is (no build step, output directory `app`). Every push to `main` redeploys it. People sign in with their Olympia account.
