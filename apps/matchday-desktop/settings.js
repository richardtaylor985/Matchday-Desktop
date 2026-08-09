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
  loadWindowsIntegrationSettings();
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


async function loadWindowsIntegrationSettings() {
  const section = document.getElementById("windowsIntegrationSettings");
  const status = document.getElementById("windowsIntegrationStatus");

  if (!section) return;

  section.style.display = "";

  if (!window.matchdayWindows) {
    document.getElementById("useMatchdayScreensaver").disabled = true;
    document.getElementById("startMatchdayWindows").disabled = true;
    document.getElementById("matchdayScreenSaverTimeout").disabled = true;
    document.getElementById("saveWindowsIntegration").disabled = true;

    if (status) {
      status.textContent =
        "Windows integration bridge unavailable. Reinstall the current Matchday Desktop build.";
    }
    return;
  }

  try {
    const state = await window.matchdayWindows.getSettings();

    document.getElementById("useMatchdayScreensaver").checked =
      state.useScreenSaver === true;

    document.getElementById("useMatchdayLiveDesktop").checked =
      state.useLiveDesktop === true;

    document.getElementById("startMatchdayWindows").checked =
      state.startWithWindows === true;

    document.getElementById("matchdayScreenSaverTimeout").value =
      String(state.timeoutSeconds || 600);

    if (status) {
      status.textContent = state.configured
        ? `Windows integration connected • bridge ${window.matchdayWindows.bridgeVersion || "ready"}`
        : `Windows integration connected • bridge ${window.matchdayWindows.bridgeVersion || "ready"} • choose your options and save.`;
    }
  } catch (error) {
    if (status) {
      status.textContent =
        `Unable to read Windows settings: ${error.message || error}`;
    }
  }
}

async function saveWindowsIntegrationSettings() {
  const status = document.getElementById("windowsIntegrationStatus");

  if (!window.matchdayWindows) {
    if (status) status.textContent = "Windows integration is available in the installed app.";
    return;
  }

  if (status) status.textContent = "Saving…";

  try {
    const saved = await window.matchdayWindows.saveSettings({
      useScreenSaver:
        document.getElementById("useMatchdayScreensaver").checked,
      useLiveDesktop:
        document.getElementById("useMatchdayLiveDesktop").checked,
      startWithWindows:
        document.getElementById("startMatchdayWindows").checked,
      timeoutSeconds:
        Number(document.getElementById("matchdayScreenSaverTimeout").value)
    });

    if (status) {
      status.textContent = saved.useScreenSaver
        ? "Saved. Matchday Desktop is now your Windows screensaver."
        : "Windows settings saved.";
    }
  } catch (error) {
    if (status) {
      status.textContent =
        `Could not save Windows settings: ${error.message || error}`;
    }
  }
}

document.addEventListener("DOMContentLoaded", () => {
  const button = document.getElementById("saveWindowsIntegration");
  if (button) {
    button.addEventListener("click", saveWindowsIntegrationSettings);
  }
});
