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

async function setStartup(enabled, exePath) {
  const script = enabled ? `
    $p='HKCU:\\Software\\Microsoft\\Windows\\CurrentVersion\\Run'
    New-Item -Path $p -Force | Out-Null
    Set-ItemProperty -Path $p -Name 'Matchday Desktop' -Value '"${q(exePath)}"'
  ` : `
    $p='HKCU:\\Software\\Microsoft\\Windows\\CurrentVersion\\Run'
    Remove-ItemProperty -Path $p -Name 'Matchday Desktop' -ErrorAction SilentlyContinue
  `;
  await ps(script);
}

module.exports = { getScreenSaverState, setMatchdayScreenSaver, restoreScreenSaver, setStartup };
