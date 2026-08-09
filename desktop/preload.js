const { ipcRenderer } = require("electron");

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
