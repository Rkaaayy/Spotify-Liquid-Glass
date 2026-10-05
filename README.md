# Liquid Glass for Spotify

**iOS 28 "Liquid Glass" GUI chrome extension for the Spotify web player** — live
refraction, chromatic edge-split, frosted depth and specular rim light, applied
to every surface of `open.spotify.com`: top bar, library sidebar, cards, track
rows, context menus, now-playing bar and the right-hand panel.

The chrome UI runs on the SVG displacement-map filter from the reference design
(three `feDisplacementMap` passes — one per RGB channel — screen-recombined,
which produces the signature chromatic liquid edge). Your exact filter markup
and base64 noise map are used verbatim; the channel scales are driven live from
the popup (`-20 / -24 / -28` at default refraction 24).

> There is also a full **interactive preview** in `demo/index.html` — a mock
> Spotify shell with a floating "Material Lab". Open it in any Chromium browser
> to feel the material before installing.

---

## ✦ Features

| | |
|---|---|
| **Real refraction** | `backdrop-filter: url(#lg-glass-filter)` with the RGB-split displacement map — not just blur |
| **Full-chrome theming** | Top bar, sidebar, cards, rows, chips, search, menus, modals, sliders, scrollbars, now-playing bar, queue panel |
| **Material Lab** | Frost · Blur · Refraction · Saturation · Specular · Corner radius · Tint hue & strength |
| **5 presets** | Aurora, Frost, Clear, Smoked, Prism |
| **Ambient backlight** | Optional animated aurora behind the app so glass has something to refract |
| **Live sync** | Popup edits apply instantly via `chrome.storage.sync` + tab messaging — no reload |
| **Responsive** | Radii/blur scale down at 1280 / 1024 / 768 / 560 px; heavy refraction drops to lite glass on small screens |
| **Motion safety** | Springy `cubic-bezier(0.32, 0.72, 0, 1)` motion, disabled under `prefers-reduced-motion` or the Animations toggle |
| **Zero-risk toggle** | Everything is gated behind `html.lg-enabled` — switch it off and Spotify is pristine |

---

## 🧩 Install (developer mode)

1. Download / clone this folder (`spotify-liquid-glass/`).
2. Open `chrome://extensions` (Edge: `edge://extensions`, Arc, Brave, etc.).
3. Enable **Developer mode** (top-right switch).
4. Click **Load unpacked** → select the `spotify-liquid-glass` folder.
5. Open <https://open.spotify.com> — the glass layer is applied immediately.
6. Click the toolbar icon to open the **Material Lab** popup.

> Optional: zip the folder first (`spotify-liquid-glass.zip`) if you want to
> keep a distributable copy — `chrome://extensions` still loads it unpacked.

---

## 🗂 Structure

```
spotify-liquid-glass/
├── manifest.json               # MV3 · storage + open.spotify.com host permission
├── content/
│   ├── content.js              # injects the SVG refraction filter, syncs settings,
│   │                           #   SPA-safe re-attach, toast pill
│   └── content.css             # the whole glass theme for Spotify's DOM
├── popup/
│   ├── popup.html              # iOS 28 control panel (glass-on-glass)
│   ├── popup.css
│   └── popup.js                # presets, sliders, tint, live preview + sync
├── background/
│   └── service-worker.js       # seeds defaults, toolbar badge (LG / off)
├── icons/                      # 16/32/48/128 app icons
├── demo/
│   └── index.html              # standalone interactive preview (offline, self-contained)
└── tools/
    └── make_icons.py           # icon generator (PIL) — regenerate if you rebrand
```

---

## ⚙️ Settings model

Stored under `chrome.storage.sync` → key `lgSettings`:

```jsonc
{
  "enabled": true,        // master toggle
  "preset": "aurora",     // aurora | frost | clear | smoked | prism | custom
  "frost": 0.12,          // glass fill opacity 0…0.6
  "saturation": 1.3,      // backdrop saturate() 0.5…2.2
  "blur": 18,             // frost blur px 0…40
  "radius": 26,           // panel corner radius px 8…40
  "tintH": 258,           // tint hue (deg)
  "tintS": 90,            // tint saturation %
  "tintL": 62,            // tint lightness %
  "tintA": 0.14,          // tint strength 0…0.6
  "spec": 0.55,           // specular highlight strength 0…1
  "border": 0.28,         // rim-light border alpha
  "refraction": 24,       // displacement scale 0…40 (feeds R/G/B at ×0.833/1/1.166)
  "ambient": true,        // aurora backlight layer
  "animations": true      // spring motion
}
```

Every value is mirrored into CSS custom properties on `:root`
(`--lg-frost`, `--lg-sat`, `--lg-blur`, `--lg-radius`, `--lg-tint-*`,
`--lg-spec`, `--lg-border`, `--lg-disp`) so you can retune the whole system
from one place.

---

## 🎨 Customising

* **Look of a surface** → edit the `.lg-glass` / `.lg-glass-lite` recipes at the
  top of `content/content.css`. Everything else references those recipes.
* **Which Spotify elements are themed** → the `:is(...)` selector groups in the
  same file. Spotify's DOM uses both class names and `data-testid` hooks; both
  are listed. If Spotify ships a redesign, add the new hooks there.
* **Refraction texture** → the base64 `feImage` displacement map lives in
  `content/content.js` (`DISPLACEMENT_MAP`) and in `popup/popup.html` /
  `demo/index.html`. Any smooth RGB noise map works — encode it as PNG and swap
  the data URI.
* **Icons** → `python3 tools/make_icons.py` (needs Pillow).

---

## 📱 Responsive behaviour

| Viewport | Behaviour |
|---|---|
| > 1280 px | Full radii (26 px) and 18 px refraction blur |
| ≤ 1280 / 1024 px | Radii and blur scale down; bars tighten |
| ≤ 768 px | Lite glass on repeated items (cards/rows) to protect frame rate |
| ≤ 560 px | Compact bars, 14 px radii |

The popup is fixed-width (380 px, Chrome's popup max) and the demo reflows:
right panel drops ≤ 1180 px, sidebar becomes an icon rail ≤ 860 px, single
column ≤ 640 px.

---

## 🧪 How the filter works

```
SourceGraphic (the page behind the panel)
      │
      ├─▶ feImage (RGB noise displacement map)
      │
      ├─▶ feDisplacementMap ×3   scales −20 / −24 / −28   (R, G, B)
      ├─▶ feColorMatrix   ×3     isolate each channel
      ├─▶ feBlend screen ×2      recombine with chromatic fringing
      └─▶ feGaussianBlur         soft glass finish
```

Applied via `backdrop-filter: url(#lg-glass-filter) saturate() blur()`, then
finished with the layered `box-shadow` rim-light stack (bright inner top edge,
deep inner falloff) from the reference CSS.

---

## 🚑 Troubleshooting — "it doesn't look like glass"

Work through these in order; the popup **Status** panel tells you exactly which
step failed (click it to re-run the checks):

| Symptom | Fix |
|---|---|
| ✗ **Spotify tab** | Open <https://open.spotify.com> in the same Chrome profile where the extension is loaded |
| ✗ **Theme engine** | **Reload the Spotify tab once** (Ctrl/Cmd+R) — content scripts don't inject into tabs that were already open when you installed |
| ✗ **Refraction filter** | Hard-reload Spotify (Ctrl/Cmd+Shift+R); check `chrome://extensions` for errors on the extension card |
| ✗ **Surfaces n/5** | Another Spotify theme (Stylus / Spicetify / userstyles) may be overriding, or Spotify shipped a redesign — report it and the selectors get patched |
| Page is glassy but flat/gray | The ambient backlight is off — enable it in the popup (it gives the glass color to refract) |
| Still stock everywhere | Make sure you loaded the **inner** `spotify-liquid-glass` folder (the one containing `manifest.json`) via **Load unpacked**, not the zip and not its parent folder |

When the engine is live you'll also see: a one-time **"✦ Liquid Glass · n/5
surfaces"** pill on the Spotify page, and a styled
`✦ Liquid Glass active` line in the DevTools console.

## ⚠️ Notes

* Requires a Chromium-based browser (`backdrop-filter` + SVG filter URL
  support). Firefox ignores `url()` filters in `backdrop-filter` and falls back
  to the flat frost recipe in `@supports not (...)`.
* Spotify's web player is a moving target — class names change between
  releases. The theme groups selectors with `:is()` so maintenance is one edit
  per surface.
* This is a personalization theme; it is not affiliated with Spotify AB or
  Apple. "Liquid Glass" refers to the visual style.
