const { app, BrowserWindow, globalShortcut, shell, dialog, ipcMain, screen } = require("electron");
const path = require("path");
const fs = require("fs");
const { execFile } = require("child_process");
const integration = require("./windows-integration");

const PRODUCT_URL =
  process.env.MATCHDAY_DESKTOP_URL ||
  "https://matchday-desktop.vercel.app/apps/matchday-desktop/index.html";

const args = process.argv.slice(1).map(v => String(v).toLowerCase());
const isDev = args.includes("--dev");
const isUninstallCleanup = args.includes("--uninstall-cleanup");
const isWallpaperMode = args.includes("--wallpaper");
let mainWindow = null;
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

    const shouldStart = !!settings.startWithWindows || !!settings.useLiveDesktop;
    const launchArgs = settings.useLiveDesktop ? "--wallpaper" : "";
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

  mainWindow.webContents.on("before-input-event", (event, input) => {
    if (!armed) return;
    const type = String(input.type || "").toLowerCase();

    if (["keydown", "keyup", "mousedown", "mouseup"].includes(type)) {
      event.preventDefault();
      quitSaver();
    }
  });

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


function nativeWindowHandleAsUInt64(win) {
  const buffer = win.getNativeWindowHandle();
  if (buffer.length >= 8) return buffer.readBigUInt64LE(0).toString();
  return BigInt(buffer.readUInt32LE(0)).toString();
}

function attachWindowToDesktop(win) {
  return new Promise((resolve, reject) => {
    const display = screen.getPrimaryDisplay();
    const bounds = display.bounds;
    const hwnd = nativeWindowHandleAsUInt64(win);
    const script = path.join(__dirname, "attach-to-desktop.ps1");

    execFile(
      "powershell.exe",
      [
        "-NoProfile",
        "-NonInteractive",
        "-ExecutionPolicy", "Bypass",
        "-File", script,
        "-ChildHwnd", hwnd,
        "-X", String(bounds.x),
        "-Y", String(bounds.y),
        "-Width", String(bounds.width),
        "-Height", String(bounds.height)
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

function createWallpaperWindow() {
  const display = screen.getPrimaryDisplay();

  mainWindow = new BrowserWindow({
    title: "Matchday Desktop Live Background",
    x: display.bounds.x,
    y: display.bounds.y,
    width: display.bounds.width,
    height: display.bounds.height,
    frame: false,
    backgroundColor: "#03070c",
    show: true,
    focusable: false,
    skipTaskbar: true,
    resizable: false,
    movable: false,
    minimizable: false,
    maximizable: false,
    fullscreenable: false,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      preload: path.join(__dirname, "preload.js")
    }
  });

  mainWindow.setIgnoreMouseEvents(true, { forward: false });
  mainWindow.loadURL(PRODUCT_URL);

  mainWindow.webContents.once("did-finish-load", async () => {
    try {
      await attachWindowToDesktop(mainWindow);
      console.log("Matchday Desktop attached behind desktop icons.");
    } catch (error) {
      console.error("Live desktop attachment failed:", error);
      dialog.showErrorBox(
        "Matchday Desktop Live Background",
        `Could not attach Matchday Desktop behind the desktop icons.\n\n${error.message || error}`
      );
      app.quit();
    }
  });

  mainWindow.on("closed", () => {
    mainWindow = null;
  });
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

  const target = settings ? `${PRODUCT_URL}?openSettings=1` : PRODUCT_URL;

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

  if (isWallpaperMode) {
    createWallpaperWindow();
    return;
  }

  if (mode === "screensaver") {
    createWindow({ fullScreen: true, kiosk: true });
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
