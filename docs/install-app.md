# Installable app (step 2 of the mobile plan)

Frostline is a Progressive Web App: from its own web address it can be added
to the iPhone/Android home screen, opens full screen with its own icon, and
plays offline.

| Piece | File |
|---|---|
| App name, icons, colours, portrait | `public/manifest.webmanifest`, `public/icons/` |
| iPhone tags (full screen, icon, title) | `index.html` |
| Offline play | `pwa/sw-template.js` → `sw.js`, generated at build with every built file (plugin in `vite.config.ts`) |
| Install button / iPhone instructions in the main menu | `src/platform/install.ts`, `InstallHint` in `src/ui/Menus.tsx` |
| Hosting | `.github/workflows/deploy.yml` (GitHub Pages) |
| 1024 px master icon (for the App Store later) | `branding/icon-1024.png` |

## Publish on GitHub Pages (once)
1. Create a repository (e.g. `frostline`) and push this folder to `main`.
2. Repository **Settings → Pages → Build and deployment → Source: GitHub Actions**.
3. Every push to `main` builds and publishes to
   `https://<your-user>.github.io/frostline/` (about 1–2 minutes).

## Install on iPhone
Open the address in **Safari** → **Share** → **Add to Home Screen**. The
main menu shows these steps too. Android Chrome shows an **Install the app** button.

## Updates
A new deploy is picked up the next time the game is opened online (pages
are fetched network-first); offline it keeps running the last version.
Saves are stored on the device and survive updates.

Note: iOS keeps an installed web app's data separate from Safari's, so a
camp started in Safari does not carry over to the home-screen app.
