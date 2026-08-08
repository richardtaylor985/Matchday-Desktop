const MATCHDAY_SETTINGS_KEY = "matchday-desktop:settings:v1";

function loadUserSettings() {
  const defaults = {
    clockFormat: "24",
    showSeconds: false
  };

  try {
    const raw = localStorage.getItem(MATCHDAY_SETTINGS_KEY);
    return raw ? { ...defaults, ...JSON.parse(raw) } : defaults;
  } catch {
    return defaults;
  }
}

function saveUserSettings(settings) {
  localStorage.setItem(MATCHDAY_SETTINGS_KEY, JSON.stringify(settings));
}

function openSettings() {
  const panel = document.getElementById("settingsPanel");
  if (!panel) return;

  const settings = loadUserSettings();
  document.getElementById("settingClockFormat").value = settings.clockFormat;
  document.getElementById("settingShowSeconds").checked = settings.showSeconds;
  panel.hidden = false;
}

function closeSettings() {
  const panel = document.getElementById("settingsPanel");
  if (panel) panel.hidden = true;
}

function applySettings() {
  const settings = {
    clockFormat: document.getElementById("settingClockFormat").value,
    showSeconds: document.getElementById("settingShowSeconds").checked
  };

  saveUserSettings(settings);
  updateClock();
  closeSettings();
}

async function loadProductMetadata() {
  try {
    const response = await fetch("app-meta.json", { cache: "no-store" });
    if (!response.ok) throw new Error("Metadata unavailable");
    const meta = await response.json();

    const version = document.getElementById("settingsVersion");
    if (version) version.textContent = meta.version || "Unknown";
  } catch {
    const version = document.getElementById("settingsVersion");
    if (version) version.textContent = "Unknown";
  }
}

async function testApiConnection() {
  const result = document.getElementById("connectionTestResult");
  if (!result) return;

  result.textContent = "TESTING…";

  try {
    const base = String(window.MATCHDAY_CONFIG?.apiBaseUrl || "").replace(/\/+$/, "");
    const response = await fetch(`${base}/api/v1/health`, { cache: "no-store" });

    if (!response.ok) throw new Error(`HTTP ${response.status}`);

    const data = await response.json();
    result.textContent = `CONNECTED • API ${data.version || "OK"}`;
  } catch (error) {
    result.textContent = `FAILED • ${error.message}`;
  }
}
