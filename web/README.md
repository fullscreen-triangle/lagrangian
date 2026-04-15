# observatory-web

Browser-native scientific instruments. WebGPU shaders do the compute;
the page ships static from a CDN. No backend.

## Stack

- **Next.js 13** (Pages Router) with `output: 'export'` — static HTML only.
- **Tailwind CSS** for styling.
- **Framer Motion** for page transitions.
- **WebGPU + WGSL** for the instruments.

## Layout

```
src/
├── pages/
│   ├── index.js                    landing
│   ├── about.js                    attribution
│   ├── documentation.js            paper index
│   ├── instruments/
│   │   ├── index.js                instrument hub
│   │   └── atmosphere.js           first live instrument
│   ├── 404.js
│   ├── _app.js
│   └── _document.js
├── components/
│   ├── Layout.js, Navbar.js, Logo.js, Footer.js        chassis
│   ├── AnimatedText.js, TransitionEffect.js, Icons.js  UI primitives
│   ├── Hooks/useThemeSwitch.js                         dark/light toggle
│   └── instruments/
│       └── AtmosphereCanvas.js     WebGPU canvas component
├── styles/
│   └── globals.css
public/
├── shaders/                        WGSL fetched at runtime
│   ├── pass0_terrain.wgsl
│   ├── pass1_weather.wgsl
│   ├── pass2_position.wgsl
│   ├── pass3_light.wgsl
│   └── pass4_render.wgsl
└── papers/                         (drop the compiled PDFs here)
```

The WGSL files under `public/shaders/` are a copy of the canonical shaders
in `../publication/shader-based-astronomy/rust/src/shaders/`. Keep them
in sync — either symlink them in development, or run a pre-build step
that mirrors the canonical directory (TBD).

## Development

```bash
npm install
npm run dev            # http://localhost:3000
```

## Static export

```bash
npm run build          # writes ./out/ with the entire deployable site
```

The `out/` directory is pure static content. Host it on any CDN
(Cloudflare Pages, Netlify, Vercel, S3, etc.). There is no server
component — the page's compute runs on the visitor's GPU.

## Browser support

WebGPU required. Chrome and Edge are stable (since 2023), Safari 26 is
in beta, Firefox is behind a flag. The atmosphere instrument's canvas
component detects missing support and surfaces a precise error rather
than a blank canvas.
