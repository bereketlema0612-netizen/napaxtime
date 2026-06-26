# Deploy Napaxtime to Production

Napaxtime is a static site (HTML + CSS + ES modules). The build copies files into `dist/` for hosting.

## Prerequisites

- [Node.js](https://nodejs.org/) 18 or newer
- A [GitHub](https://github.com) account (recommended)
- A domain (optional): `napaxtime.com`

## Local commands

```powershell
cd C:\Users\user\Projects\napaxtime
npm install          # optional — only needed for dev/preview scripts
npm run dev          # development at http://localhost:3000
npm run build        # output production files to dist/
npm run preview      # build + serve dist/ at http://localhost:4173
```

Always test with `npm run preview` before deploying.

---

## Option 1: Netlify (recommended)

1. Push this project to a GitHub repository.
2. Go to [app.netlify.com](https://app.netlify.com) → **Add new site** → **Import an existing project**.
3. Connect GitHub and select the `napaxtime` repo.
4. Netlify reads `netlify.toml` automatically:
   - **Build command:** `npm run build`
   - **Publish directory:** `dist`
5. Click **Deploy site**.

### Custom domain (napaxtime.com)

1. Netlify → **Site configuration** → **Domain management** → **Add custom domain**.
2. At your domain registrar, add DNS records Netlify provides:
   - **Apex (`napaxtime.com`):** Netlify load balancer IPs, or ALIAS/ANAME if supported
   - **WWW:** CNAME to your Netlify subdomain (e.g. `your-site.netlify.app`)
3. Enable **HTTPS** (Netlify provisions Let's Encrypt automatically).

Update `sitemap.xml` and `robots.txt` if your live URL differs from `https://napaxtime.com`.

---

## Option 2: Vercel

1. Push to GitHub.
2. Go to [vercel.com/new](https://vercel.com/new) → import the repository.
3. Vercel reads `vercel.json`:
   - **Build command:** `npm run build`
   - **Output directory:** `dist`
4. Deploy.

### Custom domain

1. Vercel project → **Settings** → **Domains** → add `napaxtime.com` and `www.napaxtime.com`.
2. Add the DNS records Vercel shows at your registrar.
3. HTTPS is automatic.

---

## Option 3: Manual deploy (drag & drop)

```powershell
npm run build
```

Upload the contents of the `dist/` folder to any static host (Cloudflare Pages, GitHub Pages, etc.).

---

## Environment variables (future phases)

No secrets are required for Phase 1 deployment. When you add Supabase or Stripe later, set variables in your host dashboard — never commit `.env` files.

| Variable | Phase | Purpose |
|---|---|---|
| `VITE_SUPABASE_URL` | Phase 2 | Cloud sync |
| `VITE_SUPABASE_ANON_KEY` | Phase 2 | Cloud sync |
| `STRIPE_PUBLIC_KEY` | Phase 3 | Payments |

---

## Post-deploy checklist

- [ ] App loads at your live URL
- [ ] Tasks save in browser (localStorage)
- [ ] Export/import backup works (Profile → Settings)
- [ ] Events tab and calendar week view work
- [ ] Mobile layout looks correct
- [ ] Custom domain + HTTPS active
- [ ] Update social/SEO meta tags in `index.html` with your live URL

---

## Troubleshooting

| Problem | Fix |
|---|---|
| Blank page / modules fail | Do not open `index.html` via `file://`. Use `npm run dev` or a hosted URL. |
| Old version showing | Hard refresh (`Ctrl+Shift+R`) or clear CDN cache after deploy. |
| Build fails | Run `npm run build` locally and fix any missing file errors. |
