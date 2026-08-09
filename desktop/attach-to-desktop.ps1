param(
  [Parameter(Mandatory=$true)][UInt64]$ChildHwnd,
  [Parameter(Mandatory=$true)][int]$X,
  [Parameter(Mandatory=$true)][int]$Y,
  [Parameter(Mandatory=$true)][int]$Width,
  [Parameter(Mandatory=$true)][int]$Height
)

Add-Type @"
using System;
using System.Collections.Generic;
using System.Runtime.InteropServices;
using System.Text;

public static class MatchdayDesktopHost {
    public delegate bool EnumWindowsProc(IntPtr hWnd, IntPtr lParam);

    [DllImport("user32.dll", SetLastError=true)]
    public static extern IntPtr FindWindow(string lpClassName, string lpWindowName);

    [DllImport("user32.dll", SetLastError=true)]
    public static extern IntPtr FindWindowEx(
        IntPtr hwndParent,
        IntPtr hwndChildAfter,
        string lpszClass,
        string lpszWindow
    );

    [DllImport("user32.dll")]
    public static extern bool EnumWindows(EnumWindowsProc lpEnumFunc, IntPtr lParam);

    [DllImport("user32.dll", SetLastError=true)]
    public static extern IntPtr SetParent(IntPtr hWndChild, IntPtr hWndNewParent);

    [DllImport("user32.dll", SetLastError=true)]
    public static extern bool SetWindowPos(
        IntPtr hWnd,
        IntPtr hWndInsertAfter,
        int X,
        int Y,
        int cx,
        int cy,
        uint uFlags
    );

    [DllImport("user32.dll", CharSet=CharSet.Auto)]
    public static extern IntPtr SendMessageTimeout(
        IntPtr hWnd,
        uint Msg,
        IntPtr wParam,
        IntPtr lParam,
        uint fuFlags,
        uint uTimeout,
        out IntPtr lpdwResult
    );

    [DllImport("user32.dll", CharSet=CharSet.Auto)]
    public static extern int GetClassName(
        IntPtr hWnd,
        StringBuilder lpClassName,
        int nMaxCount
    );

    [DllImport("user32.dll", EntryPoint="GetWindowLongPtr", SetLastError=true)]
    public static extern IntPtr GetWindowLongPtr64(IntPtr hWnd, int nIndex);

    [DllImport("user32.dll", EntryPoint="SetWindowLongPtr", SetLastError=true)]
    public static extern IntPtr SetWindowLongPtr64(IntPtr hWnd, int nIndex, IntPtr dwNewLong);

    public static readonly IntPtr HWND_BOTTOM = new IntPtr(1);

    public const int GWL_STYLE = -16;
    public const long WS_CHILD = 0x40000000L;
    public const long WS_POPUP = unchecked((long)0x80000000L);

    public const uint SMTO_NORMAL = 0x0000;
    public const uint SWP_NOSIZE = 0x0001;
    public const uint SWP_NOMOVE = 0x0002;
    public const uint SWP_NOACTIVATE = 0x0010;
    public const uint SWP_FRAMECHANGED = 0x0020;
    public const uint SWP_SHOWWINDOW = 0x0040;

    public static string ClassName(IntPtr hwnd) {
        if (hwnd == IntPtr.Zero) return "";
        StringBuilder sb = new StringBuilder(256);
        GetClassName(hwnd, sb, sb.Capacity);
        return sb.ToString();
    }

    public static List<IntPtr> TopLevelWorkers() {
        List<IntPtr> workers = new List<IntPtr>();

        EnumWindows(delegate(IntPtr top, IntPtr param) {
            if (ClassName(top) == "WorkerW") workers.Add(top);
            return true;
        }, IntPtr.Zero);

        return workers;
    }

    public static IntPtr FindIconHost() {
        IntPtr found = IntPtr.Zero;

        EnumWindows(delegate(IntPtr top, IntPtr param) {
            IntPtr defView =
                FindWindowEx(top, IntPtr.Zero, "SHELLDLL_DefView", null);

            if (defView != IntPtr.Zero) {
                found = top;
                return false;
            }

            return true;
        }, IntPtr.Zero);

        return found;
    }

    public static IntPtr ForceWorkerW(
        out IntPtr iconHost,
        out IntPtr progman,
        out string diagnostic
    ) {
        progman = FindWindow("Progman", null);

        if (progman != IntPtr.Zero) {
            IntPtr result;

            SendMessageTimeout(
                progman, 0x052C, new IntPtr(0xD), IntPtr.Zero,
                SMTO_NORMAL, 1000, out result
            );

            SendMessageTimeout(
                progman, 0x052C, new IntPtr(0xD), new IntPtr(1),
                SMTO_NORMAL, 1000, out result
            );

            SendMessageTimeout(
                progman, 0x052C, IntPtr.Zero, IntPtr.Zero,
                SMTO_NORMAL, 1000, out result
            );
        }

        System.Threading.Thread.Sleep(250);

        iconHost = FindIconHost();
        List<IntPtr> workers = TopLevelWorkers();

        IntPtr selected = IntPtr.Zero;

        foreach (IntPtr worker in workers) {
            IntPtr defView =
                FindWindowEx(worker, IntPtr.Zero, "SHELLDLL_DefView", null);

            if (defView == IntPtr.Zero) {
                selected = worker;
                break;
            }
        }

        diagnostic =
            "selected=" + ClassName(selected) +
            "; selectedHwnd=" + selected.ToInt64() +
            "; iconHost=" + ClassName(iconHost) +
            "; iconHostHwnd=" + iconHost.ToInt64() +
            "; progmanHwnd=" + progman.ToInt64() +
            "; workerCount=" + workers.Count;

        return selected;
    }

    public static void ConvertToTrueChild(IntPtr hwnd) {
        long style = GetWindowLongPtr64(hwnd, GWL_STYLE).ToInt64();
        style &= ~WS_POPUP;
        style |= WS_CHILD;

        SetWindowLongPtr64(hwnd, GWL_STYLE, new IntPtr(style));
    }
}
"@

$child = [IntPtr]::new([Int64]$ChildHwnd)

$diag = ""
$iconHost = [IntPtr]::Zero
$progman = [IntPtr]::Zero

$host = [MatchdayDesktopHost]::ForceWorkerW(
  [ref]$iconHost,
  [ref]$progman,
  [ref]$diag
)

if ($host -eq [IntPtr]::Zero) {
  throw "No independent WorkerW wallpaper host was found. $diag"
}

# NEW 3.2d:
# Put the entire wallpaper-host WorkerW BEHIND the top-level icon host.
#
# hWndInsertAfter specifies the window that precedes the positioned window
# in Z order, so placing WorkerW after iconHost puts WorkerW behind it.
if ($iconHost -ne [IntPtr]::Zero -and $host -ne $iconHost) {
  $hostOrderFlags =
    [MatchdayDesktopHost]::SWP_NOMOVE -bor
    [MatchdayDesktopHost]::SWP_NOSIZE -bor
    [MatchdayDesktopHost]::SWP_NOACTIVATE

  $ordered = [MatchdayDesktopHost]::SetWindowPos(
    $host,
    $iconHost,
    0, 0, 0, 0,
    $hostOrderFlags
  )

  if (-not $ordered) {
    $err = [Runtime.InteropServices.Marshal]::GetLastWin32Error()
    throw "Could not place WorkerW behind icon host. Win32 error $err. $diag"
  }
}

# Microsoft documents that SetParent does not change WS_POPUP/WS_CHILD.
# Convert Electron's top-level popup into a true child window explicitly.
[MatchdayDesktopHost]::ConvertToTrueChild($child)

$oldParent = [MatchdayDesktopHost]::SetParent($child, $host)
$parentError = [Runtime.InteropServices.Marshal]::GetLastWin32Error()

if ($oldParent -eq [IntPtr]::Zero -and $parentError -ne 0) {
  throw "SetParent failed with Win32 error $parentError. $diag"
}

$childFlags =
  [MatchdayDesktopHost]::SWP_NOACTIVATE -bor
  [MatchdayDesktopHost]::SWP_SHOWWINDOW -bor
  [MatchdayDesktopHost]::SWP_FRAMECHANGED

$ok = [MatchdayDesktopHost]::SetWindowPos(
  $child,
  [MatchdayDesktopHost]::HWND_BOTTOM,
  $X,
  $Y,
  $Width,
  $Height,
  $childFlags
)

if (-not $ok) {
  $err = [Runtime.InteropServices.Marshal]::GetLastWin32Error()
  throw "Could not position Matchday child window. Win32 error $err. $diag"
}

Write-Output "OK;$diag;hostOrder=behindIconHost;childStyle=WS_CHILD;childZ=HWND_BOTTOM"
