# Screenshots

Place the PNGs referenced by the root `README.md` in this folder, then uncomment
the `SCREENSHOTS` block at the top of that file.

## What to capture

| File | Content | Notes |
|------|---------|-------|
| `list.png` | Popup with the bookmark list and a couple of folders expanded | The main shot — this is what sells the extension |
| `add.png` | "Add this page" modal, prefilled from the active tab | Shows the one-click flow |
| `setup.png` | Setup screen with the server URL field | Shows that only a URL is required, no password |

## How to capture

The popup is a fixed-size window: open it, then use the OS screenshot tool
scoped to the popup region (on Windows, `Win+Shift+S`). Avoid full-desktop
captures — they make the extension look tiny in the README table.

## Before committing

- Use **demo data**, not real bookmarks: titles, URLs, folder names and the
  server URL in the setup screen are all visible in the image and end up in a
  public repository. The same applies to the username shown after login.
- A dark-mode variant of `list.png` is a nice extra, but keep the total weight
  low — these are decoration, not assets.
