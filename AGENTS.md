# AGENTS.md

Chrome/Chromium MV3 extension (React 18 + strict TypeScript + Tailwind v4) acting as a client for the Nextcloud Bookmarks app. Bundled with Webpack 5 + esbuild-loader; no backend in this repo.

## Commands

- `npm run build` — typecheck, then production build into `dist/`. `dist/` is gitignored and is the loadable extension: load it via `chrome://extensions` → "Load unpacked".
- `npm run lint` / `npm run lint:fix` — ESLint flat config (`eslint.config.mjs`).
- `npm run typecheck` — `tsc --noEmit` (already included in `build`).
- `npm run watch` — dev rebuild; `npm run clean` — remove `dist/`.
- **No test framework or test files exist.** Verification is lint + typecheck + the manual 24-step test plan in `README.md` ("Test plan"). Changes must be verified by loading `dist/` in Chrome; `chrome.*` APIs are the only runtime, no Node/browser test infra.

## Conventions (do not "fix" these)

- `package.json` and `manifest.json` versions must stay in sync: the release workflow (push a `v*` tag) hard-fails on mismatch. Bump both when changing the extension version.
- ESLint config is deliberate: `eqeqeq` with `null: 'ignore'` (use `!= null` on purpose), `no-console` allows only `warn`/`error`, unused vars are allowed when prefixed `_`.
- Commit messages use conventional prefixes (`feat:`, `ci:`, `deps-dev:`) — see `git log`.

## Architecture

- Two webpack entries: `src/popup/index.tsx` (popup UI) and `src/background/service-worker.ts` (MV3 service worker). `manifest.json` and `public/` are copied verbatim into `dist/`; the manifest references `service-worker.js`/`popup.html` by name — keep those entry names.
- Popup ↔ service worker communicate **only** via `chrome.runtime.sendMessage` with the typed action union in `src/types/index.ts` (message table in `README.md`). Never call the service worker in any other way.
- The service worker keeps **no in-memory state**: `chrome.storage.local` (config, AES-GCM-encrypted credentials, bookmark/favicon caches) and `chrome.storage.session` (login flow) are the source of truth. The popup observes state via `chrome.storage.onChanged`. The login flow is alarm-driven (1-min polling) so it survives popup close.
- The popup **never** calls the Nextcloud API directly — it always reads the local cache; a cache older than 5 minutes triggers a non-blocking background refresh.
- Cached bookmarks are grouped by **folder ID, not title** (titles are not unique across the tree); transparent migration of older title-based caches exists. When editing a multi-folder bookmark, other memberships are preserved and re-sent (the API PUT replaces the whole folder list).
- Favicons come from a 7-day TTL cache including negative results, cleared on logout.
- Dark mode uses Tailwind v4's `@custom-variant dark` (CSS-first, no `tailwind.config.js`); the only `chrome.storage.sync` value is the theme preference (credentials are never synced).
- Only `http:`/`https:` bookmark URLs are opened; other schemes are deliberately rejected.
- API paths and time thresholds live in `src/utils/constants.ts`; API calls in `src/utils/api.ts`; cache helpers in `src/utils/storage.ts`.

## CI gotchas

- `ci.yml` uploads the `dist/` build as an artifact for manual Chrome loading.
