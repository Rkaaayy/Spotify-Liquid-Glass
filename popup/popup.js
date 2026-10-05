/* ============================================================================
   LIQUID GLASS FOR SPOTIFY — popup.js
   Control panel logic: live preview in the popup + sync to open.spotify.com
   ========================================================================== */

(() => {
  "use strict";

  const STORAGE_KEY = "lgSettings";

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

  const PRESETS = {
    aurora:  { frost: 0.14, saturation: 1.35, blur: 20, radius: 28, tintH: 258, tintS: 90, tintL: 62, tintA: 0.20, spec: 0.60, border: 0.32, refraction: 26 },
    frost:   { frost: 0.22, saturation: 1.10, blur: 26, radius: 28, tintH: 210, tintS: 70, tintL: 78, tintA: 0.12, spec: 0.70, border: 0.38, refraction: 16 },
    clear:   { frost: 0.06, saturation: 1.55, blur: 10, radius: 22, tintH: 258, tintS: 40, tintL: 90, tintA: 0.05, spec: 0.65, border: 0.30, refraction: 30 },
    smoked:  { frost: 0.34, saturation: 1.05, blur: 22, radius: 24, tintH: 250, tintS: 25, tintL: 18, tintA: 0.38, spec: 0.35, border: 0.18, refraction: 12 },
    prism:   { frost: 0.10, saturation: 1.85, blur: 14, radius: 30, tintH: 330, tintS: 95, tintL: 62, tintA: 0.18, spec: 0.60, border: 0.32, refraction: 38 }
  };

  const PRESET_LABELS = {
    aurora: "Aurora", frost: "Frost", clear: "Clear", smoked: "Smoked", prism: "Prism"
  };

  let settings = { ...DEFAULTS };
  let saveTimer = null;

  const $ = (id) => document.getElementById(id);

  /* ------------------------------------------------------------------ */
  /* Popup-local live preview: rewrite CSS vars + filter scales          */
  /* ------------------------------------------------------------------ */
  function preview() {
    const root = document.documentElement.style;
    root.setProperty("--lg-frost", String(settings.frost));
    root.setProperty("--lg-sat", String(settings.saturation));
    root.setProperty("--lg-blur", `${settings.blur}px`);
    root.setProperty("--lg-radius", `${settings.radius}px`);
    root.setProperty("--lg-tint-h", String(settings.tintH));
    root.setProperty("--lg-tint-s", `${settings.tintS}%`);
    root.setProperty("--lg-tint-l", `${settings.tintL}%`);
    root.setProperty("--lg-tint-a", String(settings.tintA));
    root.setProperty("--lg-spec", String(settings.spec));
    root.setProperty("--lg-border", String(settings.border));

    const base = Number(settings.refraction) || 0;
    $("lg-disp-red")?.setAttribute("scale", String(-base * 0.833));
    $("lg-disp-green")?.setAttribute("scale", String(-base));
    $("lg-disp-blue")?.setAttribute("scale", String(-base * 1.166));
  }

  /* ------------------------------------------------------------------ */
  /* Range fill (WebKit track gradient uses --fill)                      */
  /* ------------------------------------------------------------------ */
  function paintRange(input) {
    const min = Number(input.min) || 0;
    const max = Number(input.max) || 100;
    const pct = ((Number(input.value) - min) / (max - min)) * 100;
    input.style.setProperty("--fill", `${pct}%`);
  }

  function syncOutputs() {
    $("frost-out").value = `${Math.round(settings.frost * 100)}%`;
    $("blur-out").value = `${settings.blur} px`;
    $("refraction-out").value = String(settings.refraction);
    $("saturation-out").value = `${Math.round(settings.saturation * 100)}%`;
    $("spec-out").value = `${Math.round(settings.spec * 100)}%`;
    $("radius-out").value = `${settings.radius} px`;
    $("tintA-out").value = `${Math.round(settings.tintA * 100)}%`;
    $("preset-name").textContent = PRESET_LABELS[settings.preset] || "Custom";
  }

  function syncControls() {
    $("enabled").checked = !!settings.enabled;
    $("ambient").checked = !!settings.ambient;
    $("animations").checked = !!settings.animations;

    $("frost").value = Math.round(settings.frost * 100);
    $("blur").value = settings.blur;
    $("refraction").value = settings.refraction;
    $("saturation").value = Math.round(settings.saturation * 100);
    $("spec").value = Math.round(settings.spec * 100);
    $("radius").value = settings.radius;
    $("tintA").value = Math.round(settings.tintA * 100);

    document.querySelectorAll("#presets .chip").forEach((c) => {
      c.classList.toggle("is-active", c.dataset.preset === settings.preset);
    });
    document.querySelectorAll("#tint-swatches .swatch").forEach((s) => {
      s.classList.toggle("is-active", Number(s.dataset.hue) === Number(settings.tintH));
    });

    document.querySelectorAll('input[type="range"]').forEach(paintRange);
    syncOutputs();
    preview();
  }

  /* ------------------------------------------------------------------ */
  /* Persist (debounced) → chrome.storage.sync → content script updates   */
  /* ------------------------------------------------------------------ */
  function save() {
    clearTimeout(saveTimer);
    saveTimer = setTimeout(() => {
      try {
        chrome.storage.sync.set({ [STORAGE_KEY]: settings });
        // Nudge the Spotify tab immediately (in case storage events lag)
        chrome.tabs?.query({ url: "*://open.spotify.com/*" }, (tabs) => {
          for (const tab of tabs || []) {
            chrome.tabs.sendMessage(tab.id, { type: "lg", action: "resync" }, () => void chrome.runtime.lastError);
          }
        });
      } catch {
        /* context invalidated */
      }
    }, 120);
  }

  function markCustom() {
    const activePreset = PRESETS[settings.preset];
    if (!activePreset) return;
    const same = ["frost", "saturation", "blur", "radius", "tintH", "tintA", "spec", "border", "refraction"]
      .every((k) => Math.abs((settings[k] ?? 0) - (activePreset[k] ?? 0)) < 0.001);
    if (!same) settings.preset = "custom";
  }

  /* ------------------------------------------------------------------ */
  /* Events                                                              */
  /* ------------------------------------------------------------------ */
  const RANGES = {
    frost:      (v) => v / 100,
    blur:       (v) => v,
    refraction: (v) => v,
    saturation: (v) => v / 100,
    spec:       (v) => v / 100,
    radius:     (v) => v,
    tintA:      (v) => v / 100
  };

  for (const [id, parse] of Object.entries(RANGES)) {
    $(id).addEventListener("input", (e) => {
      settings[id] = parse(Number(e.target.value));
      paintRange(e.target);
      markCustom();
      syncOutputs();
      preview();
      save();
    });
  }

  $("enabled").addEventListener("change", (e) => {
    settings.enabled = e.target.checked;
    save();
  });
  $("ambient").addEventListener("change", (e) => {
    settings.ambient = e.target.checked;
    save();
  });
  $("animations").addEventListener("change", (e) => {
    settings.animations = e.target.checked;
    save();
  });

  $("presets").addEventListener("click", (e) => {
    const btn = e.target.closest("[data-preset]");
    if (!btn) return;
    const key = btn.dataset.preset;
    settings = { ...settings, ...PRESETS[key], preset: key };
    syncControls();
    save();
  });

  $("tint-swatches").addEventListener("click", (e) => {
    const btn = e.target.closest("[data-hue]");
    if (!btn) return;
    settings.tintH = Number(btn.dataset.hue);
    settings.tintS = settings.tintH === 0 ? 0 : 90;
    markCustom();
    syncControls();
    save();
  });

  $("reset").addEventListener("click", () => {
    settings = { ...DEFAULTS };
    syncControls();
    save();
  });

  $("open-spotify").addEventListener("click", () => {
    chrome.tabs.query({ url: "*://open.spotify.com/*" }, (tabs) => {
      if (tabs?.length) {
        chrome.tabs.update(tabs[0].id, { active: true });
        chrome.windows?.update(tabs[0].windowId, { focused: true });
      } else {
        chrome.tabs.create({ url: "https://open.spotify.com" });
      }
    });
  });

  /* ------------------------------------------------------------------ */
  /* Diagnostics — is the engine actually live on an open Spotify tab?   */
  /* ------------------------------------------------------------------ */
  function setCheck(key, state, label) {
    const li = document.querySelector(`#checks li[data-k="${key}"]`);
    if (!li) return;
    li.classList.remove("ok", "bad", "wait");
    li.classList.add(state);
    const icon = li.querySelector("i");
    if (icon) icon.textContent = state === "ok" ? "✓" : state === "bad" ? "✗" : "○";
    const span = li.querySelector("span");
    if (span && label) span.textContent = label;
  }

  function runDiagnostics() {
    const pill = $("status-pill");
    pill.className = "pill pill--wait";
    pill.textContent = "checking…";
    setCheck("tab", "wait"); setCheck("script", "wait");
    setCheck("filter", "wait"); setCheck("marks", "wait");

    const finishBad = (msg) => {
      pill.className = "pill pill--bad";
      pill.textContent = "not live";
      $("status-hint").textContent = msg;
    };

    try {
      chrome.tabs.query({ url: "*://open.spotify.com/*" }, (tabs) => {
        if (chrome.runtime.lastError || !tabs || !tabs.length) {
          setCheck("tab", "bad", "Spotify tab");
          finishBad("No Spotify tab found — press “Open Spotify” below, then reload that tab once.");
          return;
        }
        setCheck("tab", "ok", "Spotify tab");
        const tab = tabs[0];
        chrome.tabs.sendMessage(tab.id, { type: "lg", action: "ping" }, (res) => {
          if (chrome.runtime.lastError || !res?.ok) {
            setCheck("script", "bad", "Theme engine");
            finishBad("Spotify tab is open but the theme engine isn’t attached yet — reload the Spotify tab (Ctrl/Cmd+R) once after installing.");
            return;
          }
          setCheck("script", "ok", "Theme engine");
          setCheck("filter", res.filterReady ? "ok" : "bad", "Refraction filter");
          const lm = res.landmarks || { count: 0, total: 5 };
          setCheck("marks", lm.count >= 3 ? "ok" : "bad", `Surfaces ${lm.count}/${lm.total}`);

          if (lm.count >= 3 && res.filterReady) {
            pill.className = "pill pill--ok";
            pill.textContent = "live ✓";
            $("status-hint").textContent =
              "Engine is live on Spotify. If the page still looks stock, disable other Spotify themes (Stylus/Spicetify) that may override it.";
          } else {
            pill.className = "pill pill--bad";
            pill.textContent = "partial";
            $("status-hint").textContent =
              "Engine attached but some surfaces weren’t found — the Spotify layout may have changed; tell me and I’ll patch the selectors.";
          }
        });
      });
    } catch {
      finishBad("Extension context lost — reload the extension on chrome://extensions.");
    }
  }

  $("status-pill").addEventListener("click", runDiagnostics);
  document.querySelector("#checks")?.addEventListener("click", runDiagnostics);

  /* ------------------------------------------------------------------ */
  /* Load                                                                */
  /* ------------------------------------------------------------------ */
  try {
    chrome.storage.sync.get(STORAGE_KEY, (data) => {
      if (chrome.runtime.lastError) console.warn("[LG]", chrome.runtime.lastError);
      settings = { ...DEFAULTS, ...(data?.[STORAGE_KEY] || {}) };
      syncControls();
      runDiagnostics();
    });
  } catch {
    settings = { ...DEFAULTS };
    syncControls();
    runDiagnostics();
  }
})();
