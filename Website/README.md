# BloodLine website

The marketing site: a long scrolling home page and a `/connect` team page, with a fixed looping video behind everything and GSAP animation on top. Built with Vite and plain JavaScript, and served as static files from Cloudflare Pages.

## Run it

```bash
cd Website
npm install
npm run dev        # http://localhost:5180
npm run build      # writes dist/
npm run preview    # serves dist/ on http://localhost:5180
```

## Deploy to GitHub Pages

`.github/workflows/website-pages.yml` builds this folder and publishes it on every push to `main` that touches `Website/` or the docs pages. It can also be run by hand from the Actions tab. The live site is at https://ar13x3.github.io/Bloodline/, and the workflow also copies `docs/*.html` to https://ar13x3.github.io/Bloodline/docs/ (PRD, pitch numbers, system design).

Project sites live under `/<repo>/`, so the workflow builds with `BASE_PATH=/Bloodline/`. Page links in the HTML use `%BASE_URL%` for that reason: Vite swaps in the right prefix, and local builds still use `/`. GitHub Pages ignores `public/_headers`.

## Deploy to Cloudflare Pages

**Option 1: Git (recommended).** In the Cloudflare dashboard, go to Workers & Pages → Create → Pages → Connect to Git, pick this repository, then set:

| Setting | Value |
|---|---|
| Root directory | `Website` |
| Build command | `npm run build` |
| Build output directory | `dist` |
| Environment variable | `NODE_VERSION` = `22` (also pinned in `.node-version`) |

Every push to the production branch deploys, and every other branch gets a preview URL.

**Option 2: Direct upload.** From this folder:

```bash
npm run deploy     # builds, then: npx wrangler@4 pages deploy dist --project-name bloodline
```

Wrangler asks you to log in the first time. The project name is set in `wrangler.toml`.

`public/_headers` sets the caching (hashed assets for a year, media for a week) and basic security headers. Cloudflare Pages applies it automatically.

## Before going live

- **Team page.** Every "Connect with us" button leads to `/connect` (`connect.html`), which lists the team with LinkedIn links. To show a role under a name, add `<p class="person__role">…</p>` after the `person__name` heading.
- **Share image URL.** `og:image` is `/og.jpg`. Some link previewers need an absolute URL, so change it to `https://<your-domain>/og.jpg` once the domain is known.
- **Video weight.** `public/media/coral-reeds-loop.mp4` is about 11 MB (Cloudflare's per-file limit is 25 MB). It works, but a smaller encode would load faster on phones, for example:

  ```bash
  ffmpeg -i coral-reeds-loop.mp4 -vf scale=1280:-2 -c:v libx264 -crf 28 -preset slow -an -movflags +faststart coral-reeds-1280.mp4
  ```

## How it's put together

| Path | What it does |
|---|---|
| `index.html` | Home page content and markup |
| `connect.html` | Team page with LinkedIn links (served at `/connect`) |
| `src/main.js` | Home page boot: smooth scrolling, loader, then each section in page order (pins measure correctly that way) |
| `src/connect.js`, `src/css/connect.css` | Team page intro animation and layout |
| `src/js/gsap.js` | Registers GSAP plugins (ScrollTrigger, SplitText, DrawSVG, MotionPath, ScrambleText) and the site's eases |
| `src/js/smooth.js` | Lenis smooth scrolling, driven by GSAP's ticker so scrubbed animation never lags the scroll |
| `src/js/mark.js` | The logo's motion: bars open out of a flat line, a heartbeat, a hover ripple |
| `src/js/background.js` | The fixed video: per-section darkening (`data-veil` on each section), slow push-in, pause button |
| `src/js/*.js` | One file per section: hero, statement, evidence, how (pipeline), triggers (stacked cards), app showcase, nots, why (horizontal track), practice, closing |
| `src/css/base.css` | Colour tokens, nav, loader, logo, buttons, shared pieces |
| `src/css/sections.css` | Section layouts, plus reduced-motion and no-script fallbacks |
| `public/media/` | Video, poster frame and the app screenshots |

### Motion rules

- Smooth, never springy: eases are `silk` (quick start, long settle) and `glide` (in-out). No overshoot.
- Scroll-linked pieces use `scrub` so they follow the scroll smoothly instead of snapping.
- Only `transform`, `opacity` and `clip-path` are animated.
- With `prefers-reduced-motion`, there's no smooth scrolling and no pinning, everything shows in its final state, and the video starts paused.

### The logo

Nine flat bars on a 4-unit pitch (3 wide, 1 gap) with the seventh bar in green. Inline SVG uses `viewBox="0 4 35 34.5"`. Use light bars (`#e6f0e8`) and accent `#56db8b` on dark backgrounds, or ink bars (`#0f3b4b`) and accent `#1e9e5e` on light ones (`.mark--ink`).

### App screenshots

The phone screens in `public/media/app/` were captured from the Expo web build against a fresh demo database (one alert per scenario, no test duplicates), at 412×868 and 3× scale, then saved as 720 px WebP.
