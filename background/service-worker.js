/* ============================================================================
   LIQUID GLASS FOR SPOTIFY — background service worker
   ========================================================================== */

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

// Seed defaults on install (without clobbering existing settings)
chrome.runtime.onInstalled.addListener(() => {
  chrome.storage.sync.get(STORAGE_KEY, (data) => {
    if (!data || !data[STORAGE_KEY]) {
      chrome.storage.sync.set({ [STORAGE_KEY]: DEFAULTS });
    }
    updateBadge(data?.[STORAGE_KEY] ?? DEFAULTS);
  });
});

// Keep the toolbar badge in sync with the enabled state
chrome.storage.onChanged.addListener((changes, area) => {
  if (area !== "sync" || !changes[STORAGE_KEY]) return;
  const next = { ...DEFAULTS, ...(changes[STORAGE_KEY].newValue || {}) };
  updateBadge(next);
});

function updateBadge(settings) {
  const on = settings?.enabled !== false;
  chrome.action.setBadgeText({ text: on ? "LG" : "off" });
  chrome.action.setBadgeBackgroundColor({ color: on ? "#7c5cff" : "#4b4b57" });
  chrome.action.setBadgeTextColor?.({ color: "#ffffff" });
}
