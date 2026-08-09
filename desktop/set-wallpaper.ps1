param(
  [Parameter(Mandatory=$true)][string]$ImagePath
)

if (-not (Test-Path -LiteralPath $ImagePath)) {
  throw "Wallpaper image does not exist: $ImagePath"
}

$resolved = (Resolve-Path -LiteralPath $ImagePath).Path

Add-Type @"
using System;
using System.Runtime.InteropServices;

public static class MatchdayWallpaper {
    [DllImport("user32.dll", SetLastError=true, CharSet=CharSet.Unicode)]
    public static extern bool SystemParametersInfo(
        uint uiAction,
        uint uiParam,
        string pvParam,
        uint fWinIni
    );

    public const uint SPI_SETDESKWALLPAPER = 0x0014;
    public const uint SPIF_UPDATEINIFILE = 0x0001;
    public const uint SPIF_SENDCHANGE = 0x0002;
}
"@

$flags =
  [MatchdayWallpaper]::SPIF_UPDATEINIFILE -bor
  [MatchdayWallpaper]::SPIF_SENDCHANGE

$ok = [MatchdayWallpaper]::SystemParametersInfo(
  [MatchdayWallpaper]::SPI_SETDESKWALLPAPER,
  0,
  $resolved,
  $flags
)

if (-not $ok) {
  $err = [Runtime.InteropServices.Marshal]::GetLastWin32Error()
  throw "SystemParametersInfo(SPI_SETDESKWALLPAPER) failed. Win32 error $err"
}

Write-Output "OK;$resolved"
