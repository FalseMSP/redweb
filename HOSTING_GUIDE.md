# Hosting RedWeb on GitHub Pages — Complete Guide

This guide walks you through hosting the RedLife Entertainment portfolio on GitHub Pages for free. The project is a Vite + React + Three.js static site, which is perfect for GitHub Pages — no server needed.

**Time required:** ~10 minutes
**Cost:** Free
**Result:** Your site live at `https://YOUR_USERNAME.github.io/REPO_NAME/`

---

## Prerequisites

- A GitHub account (free at [github.com](https://github.com))
- Git installed on your computer (`git --version` should work in terminal)
- Node.js 18+ installed (`node --version`)
- The RedWeb project files (the `redweb-fixed.zip` you downloaded)

---

## Step 1 — Create a GitHub repository

1. Go to [github.com/new](https://github.com/new)
2. Fill in:
   - **Repository name:** `redweb` (or whatever you want — this becomes part of your URL)
   - **Description:** `RedLife Entertainment — scroll-driven 3D portfolio`
   - **Visibility:** Public (required for free GitHub Pages) or Private (requires GitHub Pro for Pages)
   - **Initialize:** Leave ALL checkboxes unchecked (no README, no .gitignore, no license — we already have those)
3. Click **Create repository**
4. GitHub shows you a page with setup commands — keep this tab open, you'll need the URL in Step 3

> **URL note:** Your final site URL depends on the repo name. If your username is `falsemsp` and the repo is `redweb`, your site will be at `https://falsemsp.github.io/redweb/`. If you name the repo `falsemsp.github.io` (matching your username exactly), the site will be at `https://falsemsp.github.io/` (no sub-path). The workflow handles both cases automatically.

---

## Step 2 — Extract and prepare the project

Extract `redweb-fixed.zip` somewhere on your computer:

```bash
# Extract
unzip redweb-fixed.zip
cd redweb

# Verify the structure — you should see:
# - package.json
# - vite.config.ts
# - index.html
# - src/
# - public/
# - .github/workflows/deploy.yml  ← the auto-deploy workflow
# - .gitignore
ls -la
```

Install dependencies and test locally:

```bash
npm install
npm run dev
```

Open `http://localhost:3000` in your browser. Confirm the site loads correctly. Press `Ctrl+C` in the terminal when you're done.

---

## Step 3 — Push the code to GitHub

Initialize git and connect it to your GitHub repo:

```bash
# Initialize a new git repo in the project folder
git init

# Stage all files
git add .

# Create your first commit
git commit -m "Initial commit — RedLife portfolio"

# Set the main branch name (GitHub expects 'main')
git branch -M main

# Connect to your GitHub repo (replace with YOUR repo URL from Step 1)
git remote add origin https://github.com/YOUR_USERNAME/redweb.git

# Push to GitHub
git push -u origin main
```

When you push, GitHub will prompt for your username and password. **Use a Personal Access Token instead of your password:**

1. Go to [github.com/settings/tokens](https://github.com/settings/tokens)
2. Click **Generate new token (classic)**
3. Check the `repo` scope
4. Click **Generate token**
5. Copy the token (starts with `ghp_...`)
6. Paste it as your password when git asks

> **Alternative (easier):** Use the GitHub CLI — `gh auth login` handles auth automatically. Install from [cli.github.com](https://cli.github.com).

---

## Step 4 — Enable GitHub Pages

1. Go to your repo on GitHub: `https://github.com/YOUR_USERNAME/redweb`
2. Click the **Settings** tab
3. In the left sidebar, click **Pages**
4. Under **Build and deployment**:
   - **Source:** select **GitHub Actions** (not "Deploy from a branch")
5. That's it — no other settings needed here. The workflow file (`.github/workflows/deploy.yml`) handles everything else.

> The workflow we included will automatically:
> 1. Install dependencies (`npm ci`)
> 2. Build the site (`npm run build`)
> 3. Set the correct base path (`VITE_BASE_PATH=/redweb`)
> 4. Upload the `dist/` folder to GitHub Pages
> 5. Deploy to your `*.github.io` URL

---

## Step 5 — Watch the first deployment

1. In your repo, click the **Actions** tab
2. You'll see a workflow named **"Deploy to GitHub Pages"** running
3. Click it to watch the build logs in real-time
4. Wait for both jobs (**build** and **deploy**) to show green checkmarks (~2-3 minutes)
5. When complete, the deploy job will show a URL like:
   `https://YOUR_USERNAME.github.io/redweb/`

Click that URL — your site is live! 🎉

---

## Step 6 — Verify everything works

Open your deployed site and check:

- [ ] The loading screen appears and progresses to 100%
- [ ] The 3D scene loads (hero character + cards)
- [ ] Scroll works (wheel/trackpad/touch)
- [ ] Portfolio cards have thumbnails (not blank/squashed)
- [ ] YouTube orbit cards have thumbnails
- [ ] Card borders are visible (red outlines)
- [ ] Clicking a portfolio card opens the modal
- [ ] Clicking a YouTube card opens the video in a new tab

### If something looks broken on the deployed site but worked locally:

**Most common issue:** Asset paths. GitHub Pages serves from a sub-path (`/redweb/`), not the root (`/`). The `vite.config.ts` `base` setting handles this automatically, but if you have any hardcoded `/assets/...` URLs in your code, they need to be relative (`assets/...` without the leading slash).

Check the browser console (F12) for 404 errors. If you see any, they'll show which paths are broken.

---

## Updating your site

Every time you want to update the site:

```bash
# Make your changes, then:
git add .
git commit -m "Description of changes"
git push
```

The GitHub Actions workflow runs automatically on every push to `main`. The site updates within 2-3 minutes. You can watch progress in the **Actions** tab.

---

## Optional: Use a custom domain

If you own a domain (e.g. `redlife.studio`), you can point it at GitHub Pages:

### 1. Configure DNS

At your domain registrar, add these DNS records:

| Type | Name | Value |
|------|------|-------|
| A | `@` | `185.199.108.153` |
| A | `@` | `185.199.109.153` |
| A | `@` | `185.199.110.153` |
| A | `@` | `185.199.111.153` |
| CNAME | `www` | `YOUR_USERNAME.github.io` |

### 2. Add the domain to GitHub

1. In your repo: **Settings → Pages**
2. Under **Custom domain**, type your domain (e.g. `redlife.studio`)
3. Click **Save**
4. Check **Enforce HTTPS** (wait a few minutes for the certificate to provision)

### 3. Update vite.config.ts for the custom domain

When using a custom domain, the site is served from the root (no sub-path), so `VITE_BASE_PATH` should be empty. The workflow already handles this — when `VITE_BASE_PATH` is unset, it defaults to `/`.

But to make local builds match production, create a `.env` file:

```bash
# .env (don't commit this — it's in .gitignore)
VITE_BASE_PATH=/
```

### 4. Add a CNAME file

The GitHub Actions workflow handles this automatically via `actions/configure-pages`. But if you ever deploy manually, create a `public/CNAME` file containing just your domain:

```
redlife.studio
```

### 5. Update the OG/Twitter meta tags

In `index.html`, update the `og:url` and `og:image` URLs to use your custom domain:

```html
<meta property="og:url" content="https://redlife.studio" />
<meta property="og:image" content="https://redlife.studio/og-image.png" />
```

---

## Troubleshooting

### The site shows a blank white page

Check the browser console (F12 → Console). Common causes:

1. **404 on JavaScript chunks** — the `base` path in `vite.config.ts` is wrong. Verify the workflow is setting `VITE_BASE_PATH` correctly.
2. **CORS errors on YouTube thumbnails** — this is expected for some videos and handled by the fallback chain. Not a deployment issue.
3. **MIME type errors** — GitHub Pages sometimes serves `.js` files with the wrong MIME type. This is rare with the current Vite setup but can happen. Verify the build completed successfully.

### The 3D scene doesn't load

1. Check if WebGL is available: open `https://get.webgl.org/` in the same browser
2. Check the browser console for WebGL errors
3. The site has a 15-second loading timeout — if the scene doesn't load by then, the loading screen dismisses with a "having trouble loading" message and you can still scroll

### The hero GLB model doesn't appear

The model at `public/assets/models/hero.glb` must be committed to git. Verify it's there:

```bash
ls -la public/assets/models/hero.glb
```

If it's missing, the site falls back to the icosahedron placeholder (intentional behavior).

### The Actions workflow fails

1. Go to **Actions** tab → click the failed run → click the red `build` job
2. Scroll through the logs to find the error
3. Common fixes:
   - **`npm ci` fails** — `package-lock.json` is out of sync. Run `npm install` locally, commit the updated lock file, push.
   - **`tsc` fails** — TypeScript error. Run `npm run lint` locally to see the error, fix it, push.
   - **`vite build` fails** — build error. Run `npm run build` locally to reproduce.

### The site works locally but not on GitHub Pages

This is almost always a **base path issue**. GitHub Pages serves from `https://USERNAME.github.io/REPO_NAME/`, so all asset URLs need the `/REPO_NAME/` prefix. The `VITE_BASE_PATH` environment variable in the workflow handles this. If you see 404s for `.js` or `.css` files, check that:

1. The workflow file exists at `.github/workflows/deploy.yml`
2. The `VITE_BASE_PATH` env var is set in the build step
3. `vite.config.ts` reads it: `const base = process.env.VITE_BASE_PATH || '/';`

### GitHub Pages shows old content

GitHub Pages caches aggressively. Hard-refresh with `Ctrl+Shift+R` (or `Cmd+Shift+R` on Mac). If that doesn't work, wait 5-10 minutes for the CDN cache to expire.

---

## File reference

The deployment relies on these files (all included in the zip):

### `.gitignore`
Excludes `node_modules/`, `dist/`, `.env`, and other files that shouldn't be in git.

### `.github/workflows/deploy.yml`
The GitHub Actions workflow that runs on every push to `main`. It:
1. Checks out the code
2. Installs Node.js 20
3. Runs `npm ci` (clean install from lock file)
4. Runs `npm run build` with `VITE_BASE_PATH` set to `/<repo-name>`
5. Uploads the `dist/` folder as a Pages artifact
6. Deploys the artifact to GitHub Pages

### `vite.config.ts` (updated)
Now reads `VITE_BASE_PATH` from the environment and sets Vite's `base` option. This ensures all asset URLs are prefixed with the correct sub-path.

---

## Summary

| Step | What | Time |
|------|------|------|
| 1 | Create GitHub repo | 1 min |
| 2 | Extract project + `npm install` | 2 min |
| 3 | `git push` to GitHub | 2 min |
| 4 | Enable Pages → GitHub Actions | 1 min |
| 5 | Wait for first deploy | 3 min |
| **Total** | | **~10 min** |

Your site is now live at `https://YOUR_USERNAME.github.io/REPO_NAME/` and auto-updates on every push to `main`.
