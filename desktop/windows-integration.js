const { execFile } = require("child_process");
const path = require("path");

function ps(script) {
  return new Promise((resolve, reject) => {
    execFile("powershell.exe", ["-NoProfile", "-NonInteractive", "-ExecutionPolicy", "Bypass", "-Command", script],
      { windowsHide: true },
      (error, stdout, stderr) => {
        if (error) return reject(new Error((stderr || stdout || error.message).trim()));
        resolve((stdout || "").trim());
      });
  });
}

function q(value) {
  return String(value).replace(/'/g, "''");
}

async function getScreenSaverState() {
  const script = `
    $p='HKCU:\\Control Panel\\Desktop'
    $s=(Get-ItemProperty -Path $p -Name SCRNSAVE.EXE -ErrorAction SilentlyContinue).'SCRNSAVE.EXE'
    $a=(Get-ItemProperty -Path $p -Name ScreenSaveActive -ErrorAction SilentlyContinue).ScreenSaveActive
    $t=(Get-ItemProperty -Path $p -Name ScreenSaveTimeOut -ErrorAction SilentlyContinue).ScreenSaveTimeOut
    [pscustomobject]@{scr=$s;active=$a;timeout=$t} | ConvertTo-Json -Compress
  `;
  const out = await ps(script);
  return out ? JSON.parse(out) : {};
}

async function setMatchdayScreenSaver(scrPath, timeoutSeconds = 600) {
  const script = `
    $p='HKCU:\\Control Panel\\Desktop'
    Set-ItemProperty -Path $p -Name 'SCRNSAVE.EXE' -Value '${q(scrPath)}'
    Set-ItemProperty -Path $p -Name 'ScreenSaveActive' -Value '1'
    Set-ItemProperty -Path $p -Name 'ScreenSaveTimeOut' -Value '${Number(timeoutSeconds) || 600}'
    rundll32.exe user32.dll,UpdatePerUserSystemParameters
  `;
  await ps(script);
}

async function restoreScreenSaver(state) {
  const scr = state && state.scr ? `'${q(state.scr)}'` : "$null";
  const active = state && state.active != null ? `'${q(state.active)}'` : "$null";
  const timeout = state && state.timeout != null ? `'${q(state.timeout)}'` : "$null";
  const script = `
    $p='HKCU:\\Control Panel\\Desktop'
    $scr=${scr}; $active=${active}; $timeout=${timeout}
    if ($null -eq $scr) { Remove-ItemProperty -Path $p -Name 'SCRNSAVE.EXE' -ErrorAction SilentlyContinue }
    else { Set-ItemProperty -Path $p -Name 'SCRNSAVE.EXE' -Value $scr }
    if ($null -eq $active) { Remove-ItemProperty -Path $p -Name 'ScreenSaveActive' -ErrorAction SilentlyContinue }
    else { Set-ItemProperty -Path $p -Name 'ScreenSaveActive' -Value $active }
    if ($null -eq $timeout) { Remove-ItemProperty -Path $p -Name 'ScreenSaveTimeOut' -ErrorAction SilentlyContinue }
    else { Set-ItemProperty -Path $p -Name 'ScreenSaveTimeOut' -Value $timeout }
    rundll32.exe user32.dll,UpdatePerUserSystemParameters
  `;
  await ps(script);
}

async function setStartup(enabled, exePath, launchArgs = "") {
  const command = `"${exePath}"${launchArgs ? ` ${launchArgs}` : ""}`;

  if (enabled) {
    await new Promise((resolve, reject) => {
      execFile(
        "reg.exe",
        [
          "ADD",
          "HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Run",
          "/v",
          "Matchday Desktop",
          "/t",
          "REG_SZ",
          "/d",
          command,
          "/f"
        ],
        { windowsHide: true },
        (error, stdout, stderr) => {
          if (error) {
            reject(new Error((stderr || stdout || error.message).trim()));
            return;
          }
          resolve();
        }
      );
    });
  } else {
    await new Promise((resolve, reject) => {
      execFile(
        "reg.exe",
        [
          "DELETE",
          "HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Run",
          "/v",
          "Matchday Desktop",
          "/f"
        ],
        { windowsHide: true },
        (error, stdout, stderr) => {
          // reg.exe returns exit code 1 when the value does not exist.
          // That is already the desired end-state, so treat it as success.
          const combined = `${stdout || ""}\n${stderr || ""}`;

          if (
            error &&
            !combined.toLowerCase().includes("unable to find") &&
            !combined.toLowerCase().includes("cannot find")
          ) {
            reject(new Error((stderr || stdout || error.message).trim()));
            return;
          }

          resolve();
        }
      );
    });
  }
}

module.exports = { getScreenSaverState, setMatchdayScreenSaver, restoreScreenSaver, setStartup };
