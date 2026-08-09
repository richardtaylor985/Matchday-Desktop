const fs = require("fs");
const path = require("path");

const unpacked = path.resolve(__dirname, "..", "dist", "win-unpacked");
const exe = path.join(unpacked, "Matchday Desktop.exe");
const scr = path.join(unpacked, "Matchday Desktop.scr");

if (!fs.existsSync(exe)) {
  console.error("Expected executable not found:", exe);
  process.exit(1);
}

fs.copyFileSync(exe, scr);
console.log("Created:", scr);
console.log("Keep the .scr beside the rest of dist/win-unpacked.");
