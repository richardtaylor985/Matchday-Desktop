const { app, BrowserWindow, globalShortcut, shell, dialog, ipcMain, screen } = require("electron");
const path = require("path");
const fs = require("fs");
const { execFile } = require("child_process");
const integration = require("./windows-integration");

const PRODUCT_URL =
  process.env.MATCHDAY_DESKTOP_URL ||
  "https://matchday-desktop.vercel.app/apps/matchday-desktop/index.html";


function nativeScriptPath(filename) {
  if (app.isPackaged) {
    return path.join(process.resourcesPath, "desktop-scripts", filename);
  }

  return path.join(__dirname, filename);
}

const args = process.argv.slice(1).map(v => String(v).toLowerCase());
const isDev = args.includes("--dev");
const isUninstallCleanup = args.includes("--uninstall-cleanup");
const isDynamicWallpaperMode = args.includes("--dynamic-wallpaper");
let mainWindow = null;
let screensaverWindows = [];
let armed = false;
let lastMouse = null;
let movement = 0;

function getMode() {
  if (args.includes("--screensaver")) return "screensaver";
  if (args.includes("--config")) return "config";
  if (args.includes("--preview")) return "preview";

  const arg = args.find(v =>
    v === "/s" || v === "-s" ||
    v === "/c" || v === "-c" || v.startsWith("/c:") || v.startsWith("-c:") ||
    v === "/p" || v === "-p" || v.startsWith("/p:") || v.startsWith("-p:")
  );

  if (!arg) return "desktop";
  if (arg === "/s" || arg === "-s") return "screensaver";
  if (arg === "/c" || arg === "-c" || arg.startsWith("/c:") || arg.startsWith("-c:")) return "config";
  return "preview";
}

const mode = getMode();

const userConfigPath = () => path.join(app.getPath("userData"), "windows-integration.json");

function readUserConfig() {
  try { return JSON.parse(fs.readFileSync(userConfigPath(), "utf8")); }
  catch { return {}; }
}

function writeUserConfig(value) {
  fs.mkdirSync(path.dirname(userConfigPath()), { recursive: true });
  fs.writeFileSync(userConfigPath(), JSON.stringify(value, null, 2), "utf8");
}

function installedScrPath() {
  return path.join(path.dirname(process.execPath), "Matchday Desktop.scr");
}


async function runUninstallCleanup() {
  const current = readUserConfig();

  try {
    if (current.useScreenSaver && current.previousScreenSaver) {
      await integration.restoreScreenSaver(current.previousScreenSaver);
    }
  } catch (error) {
    console.error("Unable to restore previous screensaver:", error);
  }

  try {
    if (current.wallpaperPid && Number(current.wallpaperPid) !== process.pid) {
      stopExternalWallpaperRenderer(current.wallpaperPid);
    }

    if (current.useLiveDesktop && current.previousWallpaper) {
      await restorePreviousWallpaper(current);
    }
  } catch (error) {
    console.error("Unable to restore previous wallpaper:", error);
  }

  try {
    await integration.setStartup(false, process.execPath);
  } catch (error) {
    console.error("Unable to remove startup registration:", error);
  }

  try {
    if (fs.existsSync(userConfigPath())) {
      fs.unlinkSync(userConfigPath());
    }
  } catch (error) {
    console.error("Unable to remove Matchday integration config:", error);
  }
}

function registerIntegrationIpc() {
  ipcMain.handle("matchday:get-windows-settings", async () => readUserConfig());

  ipcMain.handle("matchday:set-selected-club", async (event, club) => {
    const normalized = String(club || "").trim().toLowerCase();

    if (!normalized) {
      throw new Error("Selected club is required.");
    }

    const current = readUserConfig();

    // A hosted renderer always persists its resolved club back to the native
    // shell. If it is already the native selected club, do nothing. This is
    // particularly important for the hidden wallpaper renderer: reloading it
    // here would create an endless load -> persist -> reload loop.
    if (current.selectedClub === normalized) {
      return current;
    }

    const next = { ...current, selectedClub: normalized };
    writeUserConfig(next);

    // A genuine club change from the visible app should refresh an existing
    // wallpaper renderer immediately. Never reload the renderer that sent the
    // persistence call itself.
    if (
      dynamicWallpaperWindow &&
      !dynamicWallpaperWindow.isDestroyed() &&
      event.sender.id !== dynamicWallpaperWindow.webContents.id
    ) {
      await dynamicWallpaperWindow.loadURL(hostedUrl({ wallpaper: true }));
    }

    return next;
  });


  ipcMain.handle("matchday:save-windows-settings", async (_event, settings) => {
    const current = readUserConfig();
    const next = { ...current, ...settings, configured: true };

    if (settings.useScreenSaver) {
      if (!current.previousScreenSaver) {
        next.previousScreenSaver = await integration.getScreenSaverState();
      }
      const scr = installedScrPath();
      if (!fs.existsSync(scr)) throw new Error(`Screensaver file not found: ${scr}`);
      await integration.setMatchdayScreenSaver(scr, settings.timeoutSeconds || 600);
    } else if (current.useScreenSaver && current.previousScreenSaver) {
      await integration.restoreScreenSaver(current.previousScreenSaver);
    }

    if (settings.useLiveDesktop) {
      if (!current.previousWallpaper) {
        next.previousWallpaper = await getCurrentWallpaperState();
      }

      if (current.wallpaperPid && Number(current.wallpaperPid) !== process.pid) {
        stopExternalWallpaperRenderer(current.wallpaperPid);
      }

      if (!dynamicWallpaperWindow || dynamicWallpaperWindow.isDestroyed()) {
        createDynamicWallpaperRenderer();
      }
    } else if (current.useLiveDesktop) {
      if (current.wallpaperPid && Number(current.wallpaperPid) !== process.pid) {
        stopExternalWallpaperRenderer(current.wallpaperPid);
      }

      stopDynamicWallpaperRenderer();

      if (current.previousWallpaper) {
        await restorePreviousWallpaper(current);
      }

      next.wallpaperPid = null;
    }

    const shouldStart = !!settings.startWithWindows || !!settings.useLiveDesktop;
    const launchArgs = settings.useLiveDesktop ? "--dynamic-wallpaper" : "";
    await integration.setStartup(shouldStart, process.execPath, launchArgs);

    writeUserConfig(next);
    return next;
  });
}


function quitSaver() {
  if (mode === "screensaver") app.quit();
}

function installDismissal() {
  armed = false;
  lastMouse = null;
  movement = 0;

  setTimeout(() => { armed = true; }, 1200);

  for (const saverWindow of screensaverWindows) {
    if (!saverWindow || saverWindow.isDestroyed()) continue;

    saverWindow.webContents.on("before-input-event", (event, input) => {
      if (!armed) return;
      const type = String(input.type || "").toLowerCase();

      if (["keydown", "keyup", "mousedown", "mouseup"].includes(type)) {
        event.preventDefault();
        quitSaver();
      }
    });
  }

  ipcMain.removeAllListeners("screensaver-user-activity");
  ipcMain.on("screensaver-user-activity", (_event, activity) => {
    if (!armed || mode !== "screensaver") return;

    if (activity?.type === "mouse") {
      const x = Number(activity.x);
      const y = Number(activity.y);
      if (!Number.isFinite(x) || !Number.isFinite(y)) return;

      if (!lastMouse) {
        lastMouse = { x, y };
        return;
      }

      movement += Math.abs(x - lastMouse.x) + Math.abs(y - lastMouse.y);
      lastMouse = { x, y };

      if (movement >= 12) quitSaver();
      return;
    }

    if (activity?.type === "click" || activity?.type === "key") {
      quitSaver();
    }
  });
}


let dynamicWallpaperWindow = null;
let dynamicWallpaperTimer = null;
let previousWallpaperPath = null;

function powershellFile(scriptPath, args = []) {
  return new Promise((resolve, reject) => {
    execFile(
      "powershell.exe",
      [
        "-NoProfile",
        "-NonInteractive",
        "-ExecutionPolicy", "Bypass",
        "-File", scriptPath,
        ...args
      ],
      { windowsHide: true },
      (error, stdout, stderr) => {
        if (error) {
          reject(new Error((stderr || stdout || error.message).trim()));
          return;
        }
        resolve((stdout || "").trim());
      }
    );
  });
}


const WALLPAPER_REFRESH_NORMAL_MS = 60 * 1000;
const WALLPAPER_REFRESH_MATCHDAY_MS = 30 * 1000;
const WALLPAPER_REFRESH_LIVE_MS = 15 * 1000;

function updateIntegrationConfig(patch) {
  const current = readUserConfig();
  const next = { ...current, ...patch };
  writeUserConfig(next);
  return next;
}

async function getCurrentWallpaperState() {
  const script = nativeScriptPath("get-wallpaper-state.ps1");
  const result = await powershellFile(script);
  return result ? JSON.parse(result) : {};
}

async function restorePreviousWallpaper(state = readUserConfig()) {
  const previous = state.previousWallpaper;
  if (!previous?.path) return false;

  const script = nativeScriptPath("restore-wallpaper.ps1");

  await powershellFile(script, [
    "-ImagePath", previous.path,
    "-WallpaperStyle", String(previous.style ?? "10"),
    "-TileWallpaper", String(previous.tile ?? "0")
  ]);

  return true;
}

async function determineWallpaperRefreshMs() {
  if (!dynamicWallpaperWindow || dynamicWallpaperWindow.isDestroyed()) {
    return WALLPAPER_REFRESH_NORMAL_MS;
  }

  try {
    return await dynamicWallpaperWindow.webContents.executeJavaScript(`
      (() => {
        const title = (document.getElementById("matchCardTitle")?.textContent || "").toUpperCase();
        const state = (document.getElementById("matchStateText")?.textContent || "").toUpperCase();

        if (title.includes("LIVE") || state.includes("LIVE")) {
          return ${15 * 1000};
        }

        if (
          title.includes("MATCHDAY") ||
          state.includes("MATCHDAY") ||
          title.includes("FULL TIME") ||
          state.includes("FULL TIME")
        ) {
          return ${30 * 1000};
        }

        return ${60 * 1000};
      })()
    `);
  } catch {
    return WALLPAPER_REFRESH_NORMAL_MS;
  }
}

async function scheduleNextDynamicWallpaperRefresh() {
  if (dynamicWallpaperTimer) {
    clearTimeout(dynamicWallpaperTimer);
    dynamicWallpaperTimer = null;
  }

  const delay = await determineWallpaperRefreshMs();

  console.log(`Next dynamic wallpaper refresh in ${delay / 1000}s`);

  dynamicWallpaperTimer = setTimeout(async () => {
    try {
      await captureAndApplyDynamicWallpaper();
    } catch (error) {
      console.error("Dynamic wallpaper refresh failed:", error?.stack || error);
    } finally {
      if (dynamicWallpaperWindow && !dynamicWallpaperWindow.isDestroyed()) {
        scheduleNextDynamicWallpaperRefresh();
      }
    }
  }, delay);
}

function stopDynamicWallpaperRenderer() {
  if (dynamicWallpaperTimer) {
    clearTimeout(dynamicWallpaperTimer);
    dynamicWallpaperTimer = null;
  }

  if (dynamicWallpaperWindow && !dynamicWallpaperWindow.isDestroyed()) {
    dynamicWallpaperWindow.destroy();
  }

  dynamicWallpaperWindow = null;

  const state = readUserConfig();
  if (state.wallpaperPid === process.pid) {
    updateIntegrationConfig({ wallpaperPid: null });
  }
}

function stopExternalWallpaperRenderer(pid) {
  if (!pid || Number(pid) === process.pid) return;

  try {
    process.kill(Number(pid));
  } catch (error) {
    console.warn("Could not stop previous wallpaper renderer:", error?.message || error);
  }
}

async function captureAndApplyDynamicWallpaper() {
  if (!dynamicWallpaperWindow || dynamicWallpaperWindow.isDestroyed()) return;

  const display = screen.getPrimaryDisplay();
  const bounds = display.bounds;
  const width = Math.max(1, bounds.width);
  const height = Math.max(1, bounds.height);

  // BrowserWindow.setSize can be affected by non-client/work-area behaviour.
  // The hidden wallpaper renderer must match the complete monitor bounds,
  // including the area Windows later covers with the taskbar.
  dynamicWallpaperWindow.setBounds({
    x: bounds.x,
    y: bounds.y,
    width,
    height
  }, false);

  const [contentWidth, contentHeight] =
    dynamicWallpaperWindow.getContentSize();

  console.log("Wallpaper capture geometry:", {
    displayId: display.id,
    bounds,
    displaySize: display.size,
    workArea: display.workArea,
    scaleFactor: display.scaleFactor,
    requested: { width, height },
    content: { width: contentWidth, height: contentHeight }
  });

  // Wait for either the explicit hosted ready flag or a DOM state that proves
  // the dashboard has rendered successfully. The latter protects wallpaper
  // capture from future changes to the hosted boot implementation.
  const readyDeadline = Date.now() + 30000;
  let readyState = null;

  while (Date.now() < readyDeadline) {
    try {
      readyState = await dynamicWallpaperWindow.webContents.executeJavaScript(`
        (() => {
          const explicit =
            Boolean(window.__MATCHDAY_READY__) ||
            document.documentElement.dataset.matchdayReady === "1";

          const selector = document.getElementById("clubSelector");
          const appShell = document.getElementById("appShell");
          const matchDate = (document.getElementById("matchDate")?.textContent || "").trim();
          const homeTeam = (document.getElementById("homeTeam")?.textContent || "").trim();
          const awayTeam = (document.getElementById("awayTeam")?.textContent || "").trim();
          const dataStatus = (document.getElementById("dataStatus")?.textContent || "").trim().toUpperCase();
          const rows = document.querySelectorAll("#tableBody tr").length;

          const selectorGone = !selector || selector.hidden === true;
          const shellVisible = !appShell || appShell.hidden !== true;
          const fixtureReady =
            matchDate &&
            !matchDate.toLowerCase().includes("loading") &&
            homeTeam &&
            awayTeam &&
            homeTeam !== "—" &&
            awayTeam !== "—";

          const dataReady =
            rows > 0 &&
            !dataStatus.includes("CONNECTING") &&
            !dataStatus.includes("LOADING");

          return {
            ready: explicit || (selectorGone && shellVisible && fixtureReady && dataReady),
            explicit,
            selectorGone,
            shellVisible,
            fixtureReady,
            dataReady,
            matchDate,
            homeTeam,
            awayTeam,
            rows,
            dataStatus
          };
        })()
      `);
    } catch (error) {
      readyState = {
        ready: false,
        error: String(error?.message || error)
      };
    }

    if (readyState?.ready) break;
    await new Promise(resolve => setTimeout(resolve, 250));
  }

  if (!readyState?.ready) {
    throw new Error(
      `Matchday dashboard did not become capture-ready within 30 seconds. ` +
      `Last state: ${JSON.stringify(readyState)}`
    );
  }

  console.log("Dynamic wallpaper ready:", readyState);

  // Run in an IIFE so local declarations do not leak into the page's global
  // lexical scope and can safely execute on every 60-second refresh.
  await dynamicWallpaperWindow.webContents.executeJavaScript(`
    (() => {
      document.body.classList.add("dynamic-wallpaper-mode");

      if (typeof updateClock === "function") {
        updateClock();
      }

      if (typeof updateCountdown === "function") {
        updateCountdown();
      }

      const currentTime = new Date();
      const heroTime = document.getElementById("heroTime");
      const heroDate = document.getElementById("heroDate");

      if (heroTime && (!heroTime.textContent || heroTime.textContent.includes("--"))) {
        heroTime.textContent = currentTime.toLocaleTimeString("en-GB", {
          hour: "2-digit",
          minute: "2-digit",
          hour12: false
        });
      }

      if (heroDate && (!heroDate.textContent || heroDate.textContent.includes("--"))) {
        heroDate.textContent = currentTime.toLocaleDateString("en-GB", {
          weekday: "long",
          day: "2-digit",
          month: "long",
          year: "numeric"
        }).toUpperCase();
      }

      return {
        ready: Boolean(window.__MATCHDAY_READY__),
        time: heroTime ? heroTime.textContent : null,
        date: heroDate ? heroDate.textContent : null
      };
    })()
  `);

  // Allow the DOM repaint to complete before capture.
  await new Promise(resolve => setTimeout(resolve, 150));

  const image = await dynamicWallpaperWindow.webContents.capturePage();

  const wallpaperDir = path.join(app.getPath("userData"), "wallpaper");
  fs.mkdirSync(wallpaperDir, { recursive: true });

  const outputPath = path.join(wallpaperDir, "matchday-desktop.png");
  fs.writeFileSync(outputPath, image.toPNG());

  const setter = nativeScriptPath("set-wallpaper.ps1");
  const result = await powershellFile(setter, [
    "-ImagePath", outputPath
  ]);

  console.log("Dynamic wallpaper refreshed:", outputPath);
  if (result) console.log("Wallpaper setter:", result);
}

function createDynamicWallpaperRenderer() {
  const display = screen.getPrimaryDisplay();
  const bounds = display.bounds;

  dynamicWallpaperWindow = new BrowserWindow({
    title: "Matchday Desktop Wallpaper Renderer",
    x: bounds.x,
    y: bounds.y,
    width: bounds.width,
    height: bounds.height,
    show: false,
    frame: false,
    backgroundColor: "#03070c",
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      preload: path.join(__dirname, "preload.js")
    }
  });

  dynamicWallpaperWindow.loadURL(hostedUrl({ wallpaper: true }));

  dynamicWallpaperWindow.webContents.once("did-finish-load", async () => {
    try {
      updateIntegrationConfig({ wallpaperPid: process.pid });
      await captureAndApplyDynamicWallpaper();
      await scheduleNextDynamicWallpaperRefresh();

      console.log("Matchday Dynamic Wallpaper active with adaptive refresh.");
    } catch (error) {
      console.error("Dynamic wallpaper startup failed:", error);
      dialog.showErrorBox(
        "Matchday Desktop Dynamic Wallpaper",
        `Could not create the Matchday Desktop wallpaper.\n\n${error.message || error}`
      );
      app.quit();
    }
  });

  dynamicWallpaperWindow.on("closed", () => {
    if (dynamicWallpaperTimer) {
      clearTimeout(dynamicWallpaperTimer);
      dynamicWallpaperTimer = null;
    }

    dynamicWallpaperWindow = null;

    const state = readUserConfig();
    if (state.wallpaperPid === process.pid) {
      updateIntegrationConfig({ wallpaperPid: null });
    }
  });
}



function hostedUrl({ settings = false, wallpaper = false } = {}) {
  const config = readUserConfig();
  const params = new URLSearchParams();

  if (settings) params.set("openSettings", "1");
  if (wallpaper) params.set("wallpaperMode", "1");
  if (config.selectedClub) params.set("club", config.selectedClub);

  const query = params.toString();

  return query
    ? `${PRODUCT_URL}${PRODUCT_URL.includes("?") ? "&" : "?"}${query}`
    : PRODUCT_URL;
}

function createScreensaverWindows() {
  const displays = screen.getAllDisplays();

  console.log(
    "Screensaver displays:",
    displays.map(display => ({
      id: display.id,
      bounds: display.bounds,
      size: display.size,
      scaleFactor: display.scaleFactor
    }))
  );

  screensaverWindows = displays.map((display, index) => {
    const bounds = display.bounds;
    const saverWindow = new BrowserWindow({
      title: `Matchday Desktop Screensaver ${index + 1}`,
      x: bounds.x,
      y: bounds.y,
      width: bounds.width,
      height: bounds.height,
      backgroundColor: "#03070c",
      autoHideMenuBar: true,
      show: false,
      frame: false,
      fullscreenable: true,
      skipTaskbar: true,
      alwaysOnTop: true,
      webPreferences: {
        contextIsolation: true,
        nodeIntegration: false,
        sandbox: true,
        preload: path.join(__dirname, "preload.js")
      }
    });

    saverWindow.loadURL(hostedUrl()).catch(error => {
      console.error(`Screensaver display ${index + 1} load failed:`, error);
    });

    saverWindow.once("ready-to-show", () => {
      // Use exact display bounds rather than workArea so the screensaver covers
      // the taskbar and every physical edge of the monitor.
      saverWindow.setBounds(bounds, false);
      saverWindow.showInactive();
    });

    saverWindow.on("closed", () => {
      screensaverWindows = screensaverWindows.filter(w => w !== saverWindow);
      if (mainWindow === saverWindow) mainWindow = null;
    });

    return saverWindow;
  });

  mainWindow = screensaverWindows[0] || null;
  installDismissal();
}

function createWindow({ fullScreen = false, kiosk = false, settings = false } = {}) {
  mainWindow = new BrowserWindow({
    title: "Matchday Desktop",
    width: 1280,
    height: 800,
    minWidth: 960,
    minHeight: 640,
    backgroundColor: "#03070c",
    autoHideMenuBar: true,
    show: true,
    fullScreen,
    kiosk,
    frame: !(fullScreen || kiosk),
    skipTaskbar: mode === "screensaver",
    alwaysOnTop: mode === "screensaver",
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      preload: path.join(__dirname, "preload.js")
    }
  });

  const target = hostedUrl({ settings });

  mainWindow.loadURL(target).catch(error => {
    console.error("Matchday Desktop load failed:", error);
  });

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: "deny" };
  });

  if (mode === "screensaver") installDismissal();

  mainWindow.on("closed", () => { mainWindow = null; });
}

app.whenReady().then(async () => {
  console.log("Matchday Desktop mode:", mode);

  if (isUninstallCleanup) {
    await runUninstallCleanup();
    app.quit();
    return;
  }

  registerIntegrationIpc();

  screen.on("display-added", () => {
    console.log("Display added; dynamic wallpaper geometry will refresh.");
    if (isDynamicWallpaperMode) captureAndApplyDynamicWallpaper().catch(console.error);
  });
  screen.on("display-removed", () => {
    console.log("Display removed; dynamic wallpaper geometry will refresh.");
    if (isDynamicWallpaperMode) captureAndApplyDynamicWallpaper().catch(console.error);
  });
  screen.on("display-metrics-changed", () => {
    console.log("Display metrics changed; dynamic wallpaper geometry will refresh.");
    if (isDynamicWallpaperMode) captureAndApplyDynamicWallpaper().catch(console.error);
  });

  if (isDynamicWallpaperMode) {
    createDynamicWallpaperRenderer();
    return;
  }

  if (mode === "screensaver") {
    createScreensaverWindows();
  } else if (mode === "config") {
    createWindow({ settings: true });
  } else if (mode === "preview") {
    console.log("Windows preview requested; preview is a no-op in Stage 3.0b.");
    app.quit();
  } else {
    const forceFullScreen = args.includes("--fullscreen");
    const firstRun = !readUserConfig().configured;
    createWindow({ fullScreen: forceFullScreen, settings: firstRun });

    globalShortcut.register("F11", () => {
      if (mainWindow) mainWindow.setFullScreen(!mainWindow.isFullScreen());
    });

    globalShortcut.register("Escape", () => {
      if (mainWindow?.isFullScreen()) mainWindow.setFullScreen(false);
    });
  }
}).catch(error => {
  dialog.showErrorBox("Matchday Desktop startup failed", String(error?.stack || error));
});

app.on("will-quit", () => {
  globalShortcut.unregisterAll();
  ipcMain.removeAllListeners("screensaver-user-activity");
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});
