param(
  [Parameter(Mandatory=$true)][string]$ImagePath,
  [string]$WallpaperStyle = "10",
  [string]$TileWallpaper = "0"
)

if (-not (Test-Path -LiteralPath $ImagePath)) {
  throw "Previous wallpaper image no longer exists: $ImagePath"
}

$p = 'HKCU:\Control Panel\Desktop'
Set-ItemProperty -Path $p -Name 'WallpaperStyle' -Value $WallpaperStyle
Set-ItemProperty -Path $p -Name 'TileWallpaper' -Value $TileWallpaper

$resolved = (Resolve-Path -LiteralPath $ImagePath).Path

Add-Type @"
using System;
using System.Runtime.InteropServices;

public static class MatchdayWallpaperRestore {
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
  [MatchdayWallpaperRestore]::SPIF_UPDATEINIFILE -bor
  [MatchdayWallpaperRestore]::SPIF_SENDCHANGE

$ok = [MatchdayWallpaperRestore]::SystemParametersInfo(
  [MatchdayWallpaperRestore]::SPI_SETDESKWALLPAPER,
  0,
  $resolved,
  $flags
)

if (-not $ok) {
  $err = [Runtime.InteropServices.Marshal]::GetLastWin32Error()
  throw "Wallpaper restore failed. Win32 error $err"
}

Write-Output "OK;$resolved"
