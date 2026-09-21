# Cutout

Free background removal that runs entirely in the browser. No account, no
watermark, no paywall — the photo never leaves the visitor's device.

Built with plain HTML/CSS/JS on [Vite](https://vitejs.dev), using the
open-source [`@imgly/background-removal`](https://github.com/imgly/background-removal-js)
model (WASM + ONNX, runs client-side).

## Local development

Requires [Node.js](https://nodejs.org) 18+.

```bash
npm install
npm run dev
```

This starts a dev server (Vite will print the local URL, usually
`http://localhost:5173`).

## Building

```bash
npm run build
```

Outputs a static site to `dist/` — plain HTML/CSS/JS, deployable anywhere
that serves static files.

## Deploying to GitHub Pages

A GitHub Actions workflow (`.github/workflows/deploy.yml`) is already set up
to build and deploy automatically on every push to `main`. To turn it on:

1. Push this repo to GitHub.
2. In the repo, go to **Settings → Pages** and set **Source** to
   **GitHub Actions**.
3. Push to `main` (or re-run the workflow from the **Actions** tab). The site
   will publish to `https://<your-username>.github.io/<repo-name>/`.

## Using a custom domain

Once you buy a domain:

1. Add a file at `public/CNAME` containing just the domain, e.g.:
   ```
   cutout.yourdomain.com
   ```
   (Vite copies everything in `public/` into `dist/` untouched, so this
   ends up at the root of the deployed site, which is where GitHub Pages
   looks for it.)
2. At your domain registrar, point the domain at GitHub Pages:
   - For a subdomain (`cutout.yourdomain.com`): add a `CNAME` DNS record
     pointing to `<your-username>.github.io`.
   - For an apex/root domain (`yourdomain.com`): add `A` records pointing
     at GitHub's Pages IPs (GitHub's docs list the current ones — search
     "GitHub Pages apex domain A records" for the up-to-date list).
3. Back in **Settings → Pages**, enter the custom domain and enable
   **Enforce HTTPS** once it's verified.

## How it works

- The model's WASM and ONNX files (40–80MB) are loaded from a CDN
  (`cdn.jsdelivr.net`) rather than bundled into this repo, so the repo stays
  small and the files are cached across the many sites already using this
  library version. To self-host them instead (e.g. for full offline use or
  to avoid the third-party request), copy the files from
  `node_modules/@imgly/background-removal/dist/` into `public/`, and change
  `MODEL_ASSET_BASE` in `src/main.js` to point at your own path.
- Everything else — the UI, the drop zone, the download flow — is plain
  JS/CSS in `src/`.

## Licensing

The code in this repository is MIT-licensed (see `LICENSE`). The background
removal itself depends on `@imgly/background-removal`, which ships under its
own license — worth a read before any commercial use: see the package's
[repo](https://github.com/imgly/background-removal-js) for current terms.
