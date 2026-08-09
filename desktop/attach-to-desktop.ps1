param(
  [Parameter(Mandatory=$true)][UInt64]$ChildHwnd,
  [Parameter(Mandatory=$true)][int]$X,
  [Parameter(Mandatory=$true)][int]$Y,
  [Parameter(Mandatory=$true)][int]$Width,
  [Parameter(Mandatory=$true)][int]$Height
)

Add-Type @"
using System;
using System.Runtime.InteropServices;

public static class MatchdayDesktopHost {
    public delegate bool EnumWindowsProc(IntPtr hWnd, IntPtr lParam);

    [DllImport("user32.dll", SetLastError=true)]
    public static extern IntPtr FindWindow(string lpClassName, string lpWindowName);

    [DllImport("user32.dll", SetLastError=true)]
    public static extern IntPtr FindWindowEx(IntPtr hwndParent, IntPtr hwndChildAfter, string lpszClass, string lpszWindow);

    [DllImport("user32.dll")]
    public static extern bool EnumWindows(EnumWindowsProc lpEnumFunc, IntPtr lParam);

    [DllImport("user32.dll", SetLastError=true)]
    public static extern IntPtr SetParent(IntPtr hWndChild, IntPtr hWndNewParent);

    [DllImport("user32.dll", SetLastError=true)]
    public static extern bool SetWindowPos(IntPtr hWnd, IntPtr hWndInsertAfter, int X, int Y, int cx, int cy, uint uFlags);

    [DllImport("user32.dll", CharSet=CharSet.Auto)]
    public static extern IntPtr SendMessageTimeout(IntPtr hWnd, uint Msg, IntPtr wParam, IntPtr lParam, uint fuFlags, uint uTimeout, out IntPtr lpdwResult);

    public const uint SMTO_NORMAL = 0x0000;
    public const uint SWP_NOACTIVATE = 0x0010;
    public const uint SWP_SHOWWINDOW = 0x0040;

    public static IntPtr FindWallpaperHost() {
        IntPtr progman = FindWindow("Progman", null);

        if (progman != IntPtr.Zero) {
            IntPtr result;
            SendMessageTimeout(progman, 0x052C, IntPtr.Zero, IntPtr.Zero, SMTO_NORMAL, 1000, out result);
        }

        IntPtr worker = IntPtr.Zero;

        EnumWindows(delegate(IntPtr top, IntPtr param) {
            IntPtr defView = FindWindowEx(top, IntPtr.Zero, "SHELLDLL_DefView", null);

            if (defView != IntPtr.Zero) {
                IntPtr candidate = FindWindowEx(IntPtr.Zero, top, "WorkerW", null);

                if (candidate != IntPtr.Zero) {
                    worker = candidate;
                    return false;
                }
            }

            return true;
        }, IntPtr.Zero);

        if (worker == IntPtr.Zero) worker = progman;
        return worker;
    }
}
"@

$child = [IntPtr]::new([Int64]$ChildHwnd)
$host = [MatchdayDesktopHost]::FindWallpaperHost()

if ($host -eq [IntPtr]::Zero) {
  throw "Could not locate a Windows desktop host window."
}

[void][MatchdayDesktopHost]::SetParent($child, $host)

$flags = [MatchdayDesktopHost]::SWP_NOACTIVATE -bor [MatchdayDesktopHost]::SWP_SHOWWINDOW
$ok = [MatchdayDesktopHost]::SetWindowPos($child, [IntPtr]::Zero, $X, $Y, $Width, $Height, $flags)

if (-not $ok) { throw "SetWindowPos failed." }

Write-Output "OK"
