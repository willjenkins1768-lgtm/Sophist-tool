# Deploying Sophist Tool as a public website

This app is a Next.js 14 project. To make it viewable by others, deploy it to a host and (optionally) add your API keys as environment variables.

---

## Option 1: Vercel (recommended)

Vercel is made by the Next.js team and has a free tier.

### 1. Push your code to GitHub

- Create a repo at [github.com/new](https://github.com/new) (e.g. `sophist-tool`).
- From your project folder:
  ```bash
  git init
  git add .
  git commit -m "Initial commit"
  git remote add origin https://github.com/YOUR_USERNAME/sophist-tool.git
  git push -u origin main
  ```
- Ensure `.env.local` is **not** committed (it’s in `.gitignore`).

### 2. Deploy on Vercel

1. Go to [vercel.com](https://vercel.com) and sign in (e.g. with GitHub).
2. **Add New Project** → **Import** your GitHub repo.
3. Leave **Framework Preset** as Next.js and **Root Directory** as `.` → **Deploy**.
4. After the first deploy, go to **Project → Settings → Environment Variables**.
5. Add each variable you use locally (names must match what the app reads):
   - `OPENAI_API_KEY` (for manifesto extraction and LLM media classification)
   - `NEWS_API_KEY` (optional)
   - `GUARDIAN_API_KEY` (optional)
   - `GNEWS_API_KEY` (optional)
6. Redeploy: **Deployments** → ⋮ on latest → **Redeploy**.

Your site will be at `https://your-project-name.vercel.app`. You can add a custom domain under **Settings → Domains**.

### Vercel: pipeline data and “No live view model”

On Vercel the filesystem is read-only except `/tmp`. The app uses `/tmp` for pipeline data when `VERCEL=1`, so **Refresh** works and returns the new view model in the response (the UI updates when you click “Refresh live data”). Data in `/tmp` is ephemeral and not shared across requests, so the **first visit** may show “No live view model” until someone clicks Refresh.

To show data on first load without clicking Refresh, ship a static snapshot:

1. Run refresh locally: `npm run refresh` (with dev server on port 3000).
2. Export the latest view model: `node scripts/export-view-model-for-vercel.js`
3. Commit `public/data/view-model-small-boats.json` and push. The deployed site will use this file when no live view model exists.

---

## Option 2: Netlify

1. Sign in at [netlify.com](https://www.netlify.com) (e.g. with GitHub).
2. **Add new site** → **Import an existing project** → choose your Git provider and repo.
3. Build settings:
   - **Build command:** `npm run build`
   - **Publish directory:** `.next` (or leave default and use Netlify’s Next.js runtime; follow their Next.js docs).
4. Add env vars under **Site settings → Environment variables** (same names as in `.env.local`).
5. Deploy. Your site will be at `https://something.netlify.app`.

---

## Option 3: Railway, Render, or other hosts

- **Railway:** Connect the GitHub repo, set build to `npm run build` and start to `npm run start`, add env vars in the dashboard.
- **Render:** New **Web Service**, connect repo, build command `npm run build`, start command `npm run start`, add env vars.

Use the same env var names as in your `.env.local` so the app behaves like it does locally.

---

## Important: API keys

- **Never** commit `.env.local` or put API keys in the repo.
- Add keys only in the host’s **Environment Variables** (or equivalent) so they stay server-side.
- If you don’t set optional keys (e.g. `NEWS_API_KEY`, `GUARDIAN_API_KEY`, `GNEWS_API_KEY`), the app will still run; it will fall back to RSS for media and skip features that need OpenAI if `OPENAI_API_KEY` is missing.

---

## Custom domain (optional)

- **Vercel:** Settings → Domains → add your domain and follow DNS instructions.
- **Netlify:** Domain management → add custom domain and configure DNS.

Once DNS is set, the site will be reachable at your domain.
