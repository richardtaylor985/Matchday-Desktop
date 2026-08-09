const fs = require("fs");
const path = require("path");

const unpacked = path.resolve(__dirname, "..", "dist", "win-unpacked");
const exe = path.join(unpacked, "Matchday Desktop.exe");
const scr = path.join(unpacked, "Matchday Desktop.scr");
if (!fs.existsSync(exe)) throw new Error(`Missing ${exe}`);
fs.copyFileSync(exe, scr);
console.log(`Prepared ${scr}`);
