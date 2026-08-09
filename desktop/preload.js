const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("matchdayWindows", {
  bridgeVersion: "3.2g3",
  getSettings: () =>
    ipcRenderer.invoke("matchday:get-windows-settings"),
  saveSettings: settings =>
    ipcRenderer.invoke("matchday:save-windows-settings", settings),
  setSelectedClub: club =>
    ipcRenderer.invoke("matchday:set-selected-club", club)
});

window.addEventListener("DOMContentLoaded", () => {
  let lastSent = 0;

  window.addEventListener("mousemove", event => {
    const now = Date.now();
    if (now - lastSent < 60) return;
    lastSent = now;

    ipcRenderer.send("screensaver-user-activity", {
      type: "mouse",
      x: event.screenX,
      y: event.screenY
    });
  }, { passive: true });

  window.addEventListener("mousedown", () => {
    ipcRenderer.send("screensaver-user-activity", { type: "click" });
  }, { passive: true });

  window.addEventListener("keydown", () => {
    ipcRenderer.send("screensaver-user-activity", { type: "key" });
  }, { passive: true });
});
