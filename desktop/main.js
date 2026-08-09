const { app, BrowserWindow, globalShortcut, shell, dialog, ipcMain } = require("electron");
const path = require("path");

const PRODUCT_URL =
  process.env.MATCHDAY_DESKTOP_URL ||
  "https://matchday-desktop.vercel.app/apps/matchday-desktop/index.html";

const args = process.argv.slice(1).map(v => String(v).toLowerCase());
const isDev = args.includes("--dev");
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

app.whenReady().then(() => {
  console.log("Matchday Desktop mode:", mode);

  if (mode === "screensaver") {
    createWindow({ fullScreen: true, kiosk: true });
  } else if (mode === "config") {
    createWindow({ settings: true });
  } else if (mode === "preview") {
    console.log("Windows preview requested; preview is a no-op in Stage 3.0b.");
    app.quit();
  } else {
    createWindow({ fullScreen: !isDev });

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
