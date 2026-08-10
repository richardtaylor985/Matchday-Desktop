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
  const timeout = Math.max(60, Number(timeoutSeconds) || 600);

  const script = `
    $ErrorActionPreference = 'Stop'
    $p='HKCU:\\Control Panel\\Desktop'

    # Persist the values used by Windows and by the legacy Screen Saver dialog.
    Set-ItemProperty -Path $p -Name 'SCRNSAVE.EXE' -Value '${q(scrPath)}'
    Set-ItemProperty -Path $p -Name 'ScreenSaveActive' -Value '1'
    Set-ItemProperty -Path $p -Name 'ScreenSaveTimeOut' -Value '${timeout}'

    Add-Type @"
using System;
using System.Runtime.InteropServices;

public static class MatchdayScreenSaverSettings {
    [DllImport("user32.dll", SetLastError=true)]
    public static extern bool SystemParametersInfo(
        uint uiAction,
        uint uiParam,
        IntPtr pvParam,
        uint fWinIni
    );

    public const uint SPI_GETSCREENSAVETIMEOUT = 0x000E;
    public const uint SPI_SETSCREENSAVETIMEOUT = 0x000F;
    public const uint SPI_SETSCREENSAVEACTIVE = 0x0011;
    public const uint SPIF_UPDATEINIFILE = 0x0001;
    public const uint SPIF_SENDCHANGE = 0x0002;
}
"@

    $flags =
      [MatchdayScreenSaverSettings]::SPIF_UPDATEINIFILE -bor
      [MatchdayScreenSaverSettings]::SPIF_SENDCHANGE

    $timeoutApplied = [MatchdayScreenSaverSettings]::SystemParametersInfo(
      [MatchdayScreenSaverSettings]::SPI_SETSCREENSAVETIMEOUT,
      ${timeout},
      [IntPtr]::Zero,
      $flags
    )

    if (-not $timeoutApplied) {
      $err = [Runtime.InteropServices.Marshal]::GetLastWin32Error()
      throw "SPI_SETSCREENSAVETIMEOUT failed with Win32 error $err"
    }

    $activeApplied = [MatchdayScreenSaverSettings]::SystemParametersInfo(
      [MatchdayScreenSaverSettings]::SPI_SETSCREENSAVEACTIVE,
      1,
      [IntPtr]::Zero,
      $flags
    )

    if (-not $activeApplied) {
      $err = [Runtime.InteropServices.Marshal]::GetLastWin32Error()
      throw "SPI_SETSCREENSAVEACTIVE failed with Win32 error $err"
    }

    # Verify both the live system timeout and persistent registry values.
    $liveTimeout = 0
    $liveOk = [MatchdayScreenSaverSettings]::SystemParametersInfo(
      [MatchdayScreenSaverSettings]::SPI_GETSCREENSAVETIMEOUT,
      0,
      [ref]$liveTimeout,
      0
    )

    $reg = Get-ItemProperty -Path $p
    $policyPath='HKCU:\\Software\\Policies\\Microsoft\\Windows\\Control Panel\\Desktop'
    $policy = Get-ItemProperty -Path $policyPath -ErrorAction SilentlyContinue

    [pscustomobject]@{
      requestedTimeout = ${timeout}
      liveTimeout = if ($liveOk) { $liveTimeout } else { $null }
      registryTimeout = [int]$reg.ScreenSaveTimeOut
      active = [string]$reg.ScreenSaveActive
      scr = [string]$reg.'SCRNSAVE.EXE'
      policyTimeout = if ($policy) { $policy.ScreenSaveTimeOut } else { $null }
      policyActive = if ($policy) { $policy.ScreenSaveActive } else { $null }
      policyScr = if ($policy) { $policy.'SCRNSAVE.EXE' } else { $null }
    } | ConvertTo-Json -Compress
  `;

  const out = await ps(script);
  const state = out ? JSON.parse(out) : {};

  if (
    Number(state.registryTimeout) !== timeout ||
    (state.liveTimeout != null && Number(state.liveTimeout) !== timeout) ||
    String(state.active) !== "1"
  ) {
    throw new Error(
      `Windows did not accept the requested screensaver timeout. ` +
      `Requested ${timeout}s; registry=${state.registryTimeout ?? "unknown"}s; ` +
      `live=${state.liveTimeout ?? "unknown"}s; active=${state.active ?? "unknown"}.`
    );
  }

  return state;
}

async function getScreenSaverDiagnostics() {
  const script = `
    $p='HKCU:\\Control Panel\\Desktop'
    $reg=Get-ItemProperty -Path $p -ErrorAction SilentlyContinue
    $policyPath='HKCU:\\Software\\Policies\\Microsoft\\Windows\\Control Panel\\Desktop'
    $policy=Get-ItemProperty -Path $policyPath -ErrorAction SilentlyContinue

    Add-Type @"
using System;
using System.Runtime.InteropServices;

public static class MatchdayScreenSaverRead {
    [DllImport("user32.dll", SetLastError=true)]
    public static extern bool SystemParametersInfo(
        uint uiAction,
        uint uiParam,
        IntPtr pvParam,
        uint fWinIni
    );

    public const uint SPI_GETSCREENSAVETIMEOUT = 0x000E;
}
"@

    $liveTimeout=0
    $liveOk=[MatchdayScreenSaverRead]::SystemParametersInfo(
      [MatchdayScreenSaverRead]::SPI_GETSCREENSAVETIMEOUT,
      0,
      [ref]$liveTimeout,
      0
    )

    [pscustomobject]@{
      registryTimeout = if ($reg.ScreenSaveTimeOut) { [int]$reg.ScreenSaveTimeOut } else { $null }
      liveTimeout = if ($liveOk) { $liveTimeout } else { $null }
      active = if ($reg.ScreenSaveActive) { [string]$reg.ScreenSaveActive } else { $null }
      scr = if ($reg.'SCRNSAVE.EXE') { [string]$reg.'SCRNSAVE.EXE' } else { $null }
      policyTimeout = if ($policy) { $policy.ScreenSaveTimeOut } else { $null }
      policyActive = if ($policy) { $policy.ScreenSaveActive } else { $null }
      policyScr = if ($policy) { $policy.'SCRNSAVE.EXE' } else { $null }
    } | ConvertTo-Json -Compress
  `;

  const out = await ps(script);
  return out ? JSON.parse(out) : {};
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

module.exports = { getScreenSaverState, getScreenSaverDiagnostics, setMatchdayScreenSaver, restoreScreenSaver, setStartup };
