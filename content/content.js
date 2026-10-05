/* ============================================================================
   LIQUID GLASS FOR SPOTIFY — content.js
   Injects the SVG refraction filter, syncs settings from chrome.storage,
   and keeps everything alive across Spotify's SPA navigations.
   ========================================================================== */

(() => {
  "use strict";

  const STORAGE_KEY = "lgSettings";
  const FILTER_ID = "lg-glass-filter";
  const SVG_ID = "lg-glass-filter-svg";

  /* ------------------------------------------------------------------ */
  /* Default settings (shared shape with popup.js / service-worker.js)   */
  /* ------------------------------------------------------------------ */
  const DEFAULTS = {
    enabled: true,
    preset: "aurora",
    frost: 0.14,
    saturation: 1.35,
    blur: 20,
    radius: 28,
    tintH: 258,
    tintS: 90,
    tintL: 62,
    tintA: 0.2,
    spec: 0.6,
    border: 0.32,
    refraction: 26,
    ambient: true,
    animations: true
  };

  let settings = { ...DEFAULTS };
  let toastTimer = null;

  /* ------------------------------------------------------------------ */
  /* Landmark probes — used for the popup diagnostics & the boot toast.  */
  /* Each entry unions semantic hooks + testid hooks + class fragments.  */
  /* ------------------------------------------------------------------ */
  const LANDMARKS = {
    topbar:
      'header:not(main header), [role="banner"], [data-testid="topbar"], [class*="topBar-container"]',
    library:
      'aside:not(main aside), [role="complementary"], [data-testid="left-sidebar"], [class*="Root__nav-bar"], [class*="yourLibrary"]',
    main:
      'main, [role="main"], [data-testid="main-view"], [class*="main-view-container"]',
    player:
      'footer:not(main footer), [role="contentinfo"], [data-testid="now-playing-bar"], [class*="nowPlayingBar"]',
    right:
      '[data-testid="right-sidebar"], [class*="Root__right-sidebar"], [class*="nowPlayingWidget"], [data-testid="now-playing-widget"]'
  };

  function scanLandmarks() {
    const found = {};
    let count = 0;
    for (const [key, sel] of Object.entries(LANDMARKS)) {
      try {
        found[key] = !!document.querySelector(sel);
      } catch {
        found[key] = false;
      }
      if (found[key]) count++;
    }
    return { found, count, total: Object.keys(LANDMARKS).length };
  }

  /* ------------------------------------------------------------------ */
  /* The displacement map (chromatic edge-split glass filter)            */
  /* Exact structure from the reference: 3× feDisplacementMap on the     */
  /* R/G/B channels with different scales + screen recombination.        */
  /* ------------------------------------------------------------------ */
  const DISPLACEMENT_MAP =
    "data:image/png;base64,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";

  function buildFilterSVG() {
    const ns = "http://www.w3.org/2000/svg";
    const svg = document.createElementNS(ns, "svg");
    svg.id = SVG_ID;
    svg.setAttribute("aria-hidden", "true");
    svg.setAttribute("class", "lg-glass-filter-svg");
    Object.assign(svg.style, {
      position: "fixed",
      width: "0",
      height: "0",
      overflow: "hidden",
      opacity: "0",
      pointerEvents: "none",
      zIndex: "-1"
    });

    svg.innerHTML = `
      <defs>
        <filter id="${FILTER_ID}" color-interpolation-filters="sRGB"
                x="0%" y="0%" width="100%" height="100%">
          <feImage x="0" y="0" width="100%" height="100%"
                   preserveAspectRatio="none" result="map"
                   href="${DISPLACEMENT_MAP}"></feImage>
          <feDisplacementMap in="SourceGraphic" in2="map" id="lg-disp-red"
            result="dispRed" scale="-20" xChannelSelector="R" yChannelSelector="G"></feDisplacementMap>
          <feColorMatrix in="dispRed" type="matrix"
            values="1 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 1 0" result="red"></feColorMatrix>
          <feDisplacementMap in="SourceGraphic" in2="map" id="lg-disp-green"
            result="dispGreen" scale="-24" xChannelSelector="R" yChannelSelector="G"></feDisplacementMap>
          <feColorMatrix in="dispGreen" type="matrix"
            values="0 0 0 0 0  0 1 0 0 0  0 0 0 0 0  0 0 0 1 0" result="green"></feColorMatrix>
          <feDisplacementMap in="SourceGraphic" in2="map" id="lg-disp-blue"
            result="dispBlue" scale="-28" xChannelSelector="R" yChannelSelector="G"></feDisplacementMap>
          <feColorMatrix in="dispBlue" type="matrix"
            values="0 0 0 0 0  0 0 0 0 0  0 0 1 0 0  0 0 0 1 0" result="blue"></feColorMatrix>
          <feBlend in="red" in2="green" mode="screen" result="rg"></feBlend>
          <feBlend in="rg" in2="blue" mode="screen" result="output"></feBlend>
          <feGaussianBlur in="output" stdDeviation="3"></feGaussianBlur>
        </filter>

        <!-- Button-only filter: same map, sharper finish, own scales so the
             hover ripple (scale 1 → 1.4) never re-renders the big panels -->
        <filter id="lg-glass-filter-btn" color-interpolation-filters="sRGB"
                x="0%" y="0%" width="100%" height="100%">
          <feImage x="0" y="0" width="100%" height="100%"
                   preserveAspectRatio="none" result="map"
                   href="${DISPLACEMENT_MAP}"></feImage>
          <feDisplacementMap in="SourceGraphic" in2="map" id="lg-disp-btn-red"
            result="dispRed" scale="-16" xChannelSelector="R" yChannelSelector="G"></feDisplacementMap>
          <feColorMatrix in="dispRed" type="matrix"
            values="1 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 1 0" result="red"></feColorMatrix>
          <feDisplacementMap in="SourceGraphic" in2="map" id="lg-disp-btn-green"
            result="dispGreen" scale="-20" xChannelSelector="R" yChannelSelector="G"></feDisplacementMap>
          <feColorMatrix in="dispGreen" type="matrix"
            values="0 0 0 0 0  0 1 0 0 0  0 0 0 0 0  0 0 0 1 0" result="green"></feColorMatrix>
          <feDisplacementMap in="SourceGraphic" in2="map" id="lg-disp-btn-blue"
            result="dispBlue" scale="-23" xChannelSelector="R" yChannelSelector="G"></feDisplacementMap>
          <feColorMatrix in="dispBlue" type="matrix"
            values="0 0 0 0 0  0 0 0 0 0  0 0 1 0 0  0 0 0 1 0" result="blue"></feColorMatrix>
          <feBlend in="red" in2="green" mode="screen" result="rg"></feBlend>
          <feBlend in="rg" in2="blue" mode="screen" result="output"></feBlend>
          <feGaussianBlur in="output" stdDeviation="2"></feGaussianBlur>
        </filter>

        <!-- Player-dock filter: high-displacement pass for the strong
             chromatic edge fringe (red/cyan split) of the reference widget -->
        <filter id="lg-glass-filter-player" color-interpolation-filters="sRGB"
                x="0%" y="0%" width="100%" height="100%">
          <feImage x="0" y="0" width="100%" height="100%"
                   preserveAspectRatio="none" result="map"
                   href="${DISPLACEMENT_MAP}"></feImage>
          <feDisplacementMap in="SourceGraphic" in2="map" id="lg-disp-pl-red"
            result="dispRed" scale="-27" xChannelSelector="R" yChannelSelector="G"></feDisplacementMap>
          <feColorMatrix in="dispRed" type="matrix"
            values="1 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 1 0" result="red"></feColorMatrix>
          <feDisplacementMap in="SourceGraphic" in2="map" id="lg-disp-pl-green"
            result="dispGreen" scale="-33" xChannelSelector="R" yChannelSelector="G"></feDisplacementMap>
          <feColorMatrix in="dispGreen" type="matrix"
            values="0 0 0 0 0  0 1 0 0 0  0 0 0 0 0  0 0 0 1 0" result="green"></feColorMatrix>
          <feDisplacementMap in="SourceGraphic" in2="map" id="lg-disp-pl-blue"
            result="dispBlue" scale="-39" xChannelSelector="R" yChannelSelector="G"></feDisplacementMap>
          <feColorMatrix in="dispBlue" type="matrix"
            values="0 0 0 0 0  0 0 0 0 0  0 0 1 0 0  0 0 0 1 0" result="blue"></feColorMatrix>
          <feBlend in="red" in2="green" mode="screen" result="rg"></feBlend>
          <feBlend in="rg" in2="blue" mode="screen" result="output"></feBlend>
          <feGaussianBlur in="output" stdDeviation="2.5"></feGaussianBlur>
        </filter>
      </defs>`;

    return svg;
  }

  function ensureFilter() {
    if (document.getElementById(SVG_ID)) return;
    const host = document.documentElement || document.body || document;
    host.appendChild(buildFilterSVG());
  }

  /* ------------------------------------------------------------------ */
  /* Apply settings → CSS variables + filter scales                      */
  /* ------------------------------------------------------------------ */
  function applySettings() {
    const root = document.documentElement;
    if (!root) return;

    root.classList.toggle("lg-enabled", !!settings.enabled);
    root.classList.toggle("lg-ambient", !!settings.enabled && !!settings.ambient);
    root.classList.toggle("lg-no-motion", !settings.animations);

    const v = root.style;
    v.setProperty("--lg-frost", String(settings.frost));
    v.setProperty("--lg-sat", String(settings.saturation));
    v.setProperty("--lg-blur", `${settings.blur}px`);
    v.setProperty("--lg-radius", `${settings.radius}px`);
    v.setProperty("--lg-tint-h", String(settings.tintH));
    v.setProperty("--lg-tint-s", `${settings.tintS}%`);
    v.setProperty("--lg-tint-l", `${settings.tintL}%`);
    v.setProperty("--lg-tint-a", String(settings.tintA));
    v.setProperty("--lg-spec", String(settings.spec));
    v.setProperty("--lg-border", String(settings.border));
    v.setProperty("--lg-disp", String(settings.refraction));

    // Channel-split scales keep the reference ratios (-20 / -24 / -28)
    const base = Number(settings.refraction) || 0;
    const red = document.getElementById("lg-disp-red");
    const green = document.getElementById("lg-disp-green");
    const blue = document.getElementById("lg-disp-blue");
    if (red) red.setAttribute("scale", String(-base * 0.833));
    if (green) green.setAttribute("scale", String(-base));
    if (blue) blue.setAttribute("scale", String(-base * 1.166));

    // Button filter baseline (ripple multiplies over these)
    btnBase = base * 0.8;
    setBtnScales(1 + 0.4 * rippleT);

    // Player dock: high-displacement trio (1.25×) for the chromatic edge fringe
    const plRed = document.getElementById("lg-disp-pl-red");
    const plGreen = document.getElementById("lg-disp-pl-green");
    const plBlue = document.getElementById("lg-disp-pl-blue");
    if (plRed) plRed.setAttribute("scale", String(-base * 1.25 * 0.833));
    if (plGreen) plGreen.setAttribute("scale", String(-base * 1.25));
    if (plBlue) plBlue.setAttribute("scale", String(-base * 1.25 * 1.166));

    // Animations master switch (complements prefers-reduced-motion)
    if (!settings.animations) {
      if (!document.getElementById("lg-style-nomotion")) {
        const st = document.createElement("style");
        st.id = "lg-style-nomotion";
        st.textContent =
          "html.lg-enabled *, html.lg-enabled *::before, html.lg-enabled *::after {" +
          "animation-duration:.01ms !important;animation-iteration-count:1 !important;" +
          "transition-duration:.01ms !important;}";
        document.documentElement.appendChild(st);
      }
    } else {
      document.getElementById("lg-style-nomotion")?.remove();
    }
  }

  /* ------------------------------------------------------------------ */
  /* Button liquid ripple (family A′ — displacement 1 → 1.4 on hover)    */
  /* Ramps only the button-filter trio, never the big panel filter.      */
  /* ------------------------------------------------------------------ */
  let btnBase = (DEFAULTS.refraction || 24) * 0.8;
  let rippleT = 0;
  let rippleDir = 0;
  let rippleRaf = 0;

  function setBtnScales(mult) {
    const red = document.getElementById("lg-disp-btn-red");
    const green = document.getElementById("lg-disp-btn-green");
    const blue = document.getElementById("lg-disp-btn-blue");
    if (red) red.setAttribute("scale", String(-btnBase * 0.833 * mult));
    if (green) green.setAttribute("scale", String(-btnBase * mult));
    if (blue) blue.setAttribute("scale", String(-btnBase * 1.166 * mult));
  }

  function rippleTick() {
    rippleT += rippleDir * 0.075;
    if (rippleT >= 1) { rippleT = 1; rippleDir = 0; }
    if (rippleT <= 0) { rippleT = 0; rippleDir = 0; }
    setBtnScales(1 + 0.4 * rippleT);
    if (rippleDir !== 0) {
      rippleRaf = requestAnimationFrame(rippleTick);
    }
  }

  function rippleGo(dir) {
    rippleDir = dir;
    cancelAnimationFrame(rippleRaf);
    rippleRaf = requestAnimationFrame(rippleTick);
  }

  const BTN_HOT_SELECTOR = [
    '[class*="playButton"]',
    '[data-testid="play-button"]',
    '[class*="main-button-button"]',
    '[data-testid="topbar-back-button"]',
    '[data-testid="topbar-forward-button"]',
    '[class*="topBar-credits"]',
    '[class*="actionBar-ActionBar"] button',
    '[class*="player-controls"] button',
    '[class*="control-button"]',
    'header:not(main header) button'
  ].join(",");

  function hotButton(target) {
    try {
      return target && target.closest ? target.closest(BTN_HOT_SELECTOR) : null;
    } catch {
      return null;
    }
  }

  document.addEventListener(
    "pointerover",
    (e) => {
      if (!settings.enabled || !settings.animations) return;
      if (hotButton(e.target)) rippleGo(1);
    },
    true
  );

  document.addEventListener(
    "pointerout",
    (e) => {
      const btn = hotButton(e.target);
      if (!btn) return;
      const to = e.relatedTarget;
      if (to && btn.contains(to)) return; // moved within the same button
      rippleGo(-1);
    },
    true
  );

  /* ------------------------------------------------------------------ */
  /* Toast notification pill                                             */
  /* ------------------------------------------------------------------ */
  function toast(message) {
    let el = document.querySelector(".lg-toast");
    if (!el) {
      el = document.createElement("div");
      el.className = "lg-toast";
      el.setAttribute("role", "status");
      (document.body || document.documentElement).appendChild(el);
    }
    el.textContent = message;
    requestAnimationFrame(() => el.classList.add("lg-toast--show"));
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => el.classList.remove("lg-toast--show"), 1900);
  }

  /* ------------------------------------------------------------------ */
  /* Settings plumbing                                                   */
  /* ------------------------------------------------------------------ */
  function merge(raw) {
    settings = { ...DEFAULTS, ...(raw || {}) };
    return settings;
  }

  function loadSettings(then) {
    try {
      chrome.storage.sync.get(STORAGE_KEY, (data) => {
        if (chrome.runtime.lastError) {
          /* fall through with defaults */
        }
        merge(data?.[STORAGE_KEY]);
        then?.();
      });
    } catch {
      /* extension context invalidated (extension reloaded) — keep defaults */
      merge(null);
      then?.();
    }
  }

  /* ------------------------------------------------------------------ */
  /* Boot                                                                */
  /* ------------------------------------------------------------------ */
  function boot() {
    ensureFilter();
    loadSettings(() => {
      applySettings();

      // Visible + logged confirmation that the engine is live on this page
      const scan = scanLandmarks();
      try {
        console.log(
          "%c✦ Liquid Glass %cactive",
          "background:#7c5cff;color:#fff;padding:3px 8px;border-radius:6px 0 0 6px;font-weight:700",
          "background:#221a3d;color:#cbb8ff;padding:3px 8px;border-radius:0 6px 6px 0",
          `· ${scan.count}/${scan.total} landmarks · filter ${document.getElementById(SVG_ID) ? "ready" : "missing"}`
        );
      } catch {
        /* console unavailable */
      }

      if (settings.enabled) {
        try {
          if (!sessionStorage.getItem("lg-hello")) {
            sessionStorage.setItem("lg-hello", "1");
            toast(`✦ Liquid Glass · ${scan.count}/${scan.total} surfaces`);
          }
        } catch {
          toast("✦ Liquid Glass active");
        }
      }
    });
  }

  // document_start: DOM may still be parsing
  if (document.documentElement) {
    boot();
  } else {
    window.addEventListener("DOMContentLoaded", boot, { once: true });
  }

  // Keep the filter node alive through Spotify's SPA re-renders
  const observer = new MutationObserver(() => {
    if (!document.getElementById(SVG_ID)) ensureFilter();
  });
  observer.observe(document.documentElement, { childList: true });

  // Live updates from the popup (chrome.storage writes also fire this)
  try {
    chrome.storage.onChanged.addListener((changes, area) => {
      if (area !== "sync" || !changes[STORAGE_KEY]) return;
      merge(changes[STORAGE_KEY].newValue);
      ensureFilter();
      applySettings();
    });
  } catch {
    /* context invalidated */
  }

  // Direct messages (popup ping / toggle / toast)
  try {
    chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
      if (!msg || msg.type !== "lg") return;
      switch (msg.action) {
        case "ping":
          sendResponse({
            ok: true,
            settings,
            filterReady: !!document.getElementById(SVG_ID),
            landmarks: scanLandmarks()
          });
          break;
        case "toggle":
          settings.enabled = msg.enabled ?? !settings.enabled;
          applySettings();
          toast(settings.enabled ? "Liquid Glass · on" : "Liquid Glass · off");
          sendResponse({ ok: true, settings });
          break;
        case "toast":
          toast(msg.text || "");
          sendResponse({ ok: true });
          break;
        case "resync":
          loadSettings(() => {
            applySettings();
            sendResponse({ ok: true, settings });
          });
          return true; /* async */
        default:
          sendResponse({ ok: false });
      }
      return undefined;
    });
  } catch {
    /* context invalidated */
  }
})();
