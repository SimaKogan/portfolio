# Sima Kogan — portfolio

Personal portfolio of **Sima Kogan** — AI Engineer & Full Stack Developer, Jerusalem.
Live at **https://simakogan.github.io/portfolio/**

Plain HTML, CSS and JavaScript. No build step, no frameworks, no CDN, no trackers, no third-party fonts or scripts.

## Features

- Animated "embedding space" background — the pointer acts as a query and lights up its 5 nearest points
- Three languages (English, Русский, עברית) with automatic right-to-left layout, dark / light theme
- **Interpolation Lab** (`lab.html`): drag points and compare linear, Lagrange, Newton and natural cubic-spline interpolation
- Respects `prefers-reduced-motion`, keyboard-accessible, responsive

## Run locally

```bash
python3 -m http.server 8000     # or: npx serve .
# open http://localhost:8000
```

## Tests

The interpolation maths is in `js/interp.js` (pure functions, no DOM):

```bash
node tests/interp.test.js
```

## Edit the content

- Texts and translations: `js/i18n.js`
- Skills, projects, contacts: `index.html`
- Colours: CSS variables at the top of `css/style.css`

## Publish on GitHub Pages

1. Create a **public** repository named `portfolio`.
2. Push this folder to its `main` branch.
3. Repository → Settings → Pages → *Deploy from a branch* → `main` / `/ (root)`.

```bash
git init
git add .
git commit -m "feat: portfolio site"
git branch -M main
git remote add origin git@github.com:SimaKogan/portfolio.git
git push -u origin main
```

## License

MIT © Sima Kogan
