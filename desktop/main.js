const { app, BrowserWindow, globalShortcut, shell, dialog } = require("electron");

const PRODUCT_URL =
  process.env.MATCHDAY_DESKTOP_URL ||
  "https://matchday-desktop.vercel.app/apps/matchday-desktop/index.html";

const isDev = process.argv.includes("--dev");
let mainWindow = null;

function createWindow() {
  mainWindow = new BrowserWindow({
    title: "Matchday Desktop",
    width: 1280,
    height: 800,
    minWidth: 960,
    minHeight: 640,
    backgroundColor: "#03070c",
    autoHideMenuBar: true,
    show: true,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true
    }
  });

  if (!isDev) {
    mainWindow.setFullScreen(true);
  }

  mainWindow.loadURL(PRODUCT_URL).catch(error => {
    console.error("Matchday Desktop loadURL failed:", error);

    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.loadURL(
        "data:text/html;charset=utf-8," +
        encodeURIComponent(`
          <html>
            <body style="
              margin:0;
              background:#03070c;
              color:#fff;
              font-family:Segoe UI,Arial,sans-serif;
              display:grid;
              place-items:center;
              min-height:100vh;
            ">
              <div style="max-width:720px;padding:40px">
                <h1>Matchday Desktop could not load</h1>
                <p>The Windows shell started correctly, but the hosted Matchday Desktop page could not be reached.</p>
                <p><strong>URL:</strong> ${PRODUCT_URL}</p>
                <p>${String(error.message || error)}</p>
              </div>
            </body>
          </html>
        `)
      );
    }
  });

  mainWindow.webContents.on(
    "did-fail-load",
    (_event, errorCode, errorDescription, validatedURL, isMainFrame) => {
      if (isMainFrame) {
        console.error(
          "Renderer failed to load:",
          errorCode,
          errorDescription,
          validatedURL
        );
      }
    }
  );

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: "deny" };
  });

  mainWindow.webContents.on("will-navigate", (event, url) => {
    const productOrigin = new URL(PRODUCT_URL).origin;

    if (!url.startsWith(productOrigin)) {
      event.preventDefault();
      shell.openExternal(url);
    }
  });

  mainWindow.on("closed", () => {
    mainWindow = null;
  });
}

app.whenReady().then(() => {
  console.log("Electron ready.");
  console.log("Loading:", PRODUCT_URL);
  console.log("Mode:", isDev ? "development window" : "fullscreen");

  createWindow();

  globalShortcut.register("F11", () => {
    if (mainWindow) {
      mainWindow.setFullScreen(!mainWindow.isFullScreen());
    }
  });

  globalShortcut.register("Escape", () => {
    if (mainWindow?.isFullScreen()) {
      mainWindow.setFullScreen(false);
    }
  });

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
}).catch(error => {
  console.error("Electron startup failed:", error);
  dialog.showErrorBox(
    "Matchday Desktop startup failed",
    String(error?.stack || error)
  );
});

app.on("will-quit", () => {
  globalShortcut.unregisterAll();
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});
