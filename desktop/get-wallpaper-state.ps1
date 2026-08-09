$p = 'HKCU:\Control Panel\Desktop'
$item = Get-ItemProperty -Path $p

[pscustomobject]@{
  path  = $item.WallPaper
  style = $item.WallpaperStyle
  tile  = $item.TileWallpaper
} | ConvertTo-Json -Compress
