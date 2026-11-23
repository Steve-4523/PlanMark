# PlanMark

PDF markup and takeoff app for Olympia Holdings (web + Windows desktop).

- `app/` — the live app files. The Windows app checks `app/manifest.json` every 20 seconds (and whenever the window is focused); the update is applied automatically as soon as the user pauses; any file whose SHA-256 matches the manifest is installed automatically. Files that don't match are rejected.
- `desktop/` — source for the Windows shell (Electron) and its updater.

To release an update: change files in `app/`, regenerate `app/manifest.json` with a higher version, and push to `main`.

## Website
`app/` is also the public site planmark.olympiaholdings.com: a Vercel project serves this folder as-is (root directory `app`, no build). It needs no sign-in; files open in the visitor's browser and are never uploaded. `app/vercel.json` sets strict security rules (only its own code runs; it talks only to itself and the Olympia sign-in; it can't be embedded in other sites). Every push to `main` redeploys it.
