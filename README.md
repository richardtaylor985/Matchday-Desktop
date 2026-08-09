# Matchday Desktop

Cloud-backed football desktop/screen information platform.

The current working client is the Coventry City prototype:

    apps/sky-blues-screensaver/

The repository also contains the first Vercel API gateway:

    GET /api/v1/health
    GET /api/v1/clubs/coventry-city

## Repository structure

    Matchday-Desktop/
    ├── apps/
    │   └── sky-blues-screensaver/
    ├── api/
    │   └── v1/
    ├── docs/
    ├── .env.example
    ├── .gitignore
    ├── package.json
    └── vercel.json

## First Git setup on Windows

Open PowerShell:

    cd C:\Users\Rich\Projects\Matchday-Desktop

Then:

    git init
    git branch -M main
    git add .
    git commit -m "Initial Matchday Desktop platform"

Create an empty GitHub repository named `Matchday-Desktop`, then connect it:

    git remote add origin https://github.com/YOUR-USERNAME/Matchday-Desktop.git
    git push -u origin main

Do not commit `config.local.json`, `.env`, API keys, or cache folders.

## Vercel setup

Import the GitHub repository into Vercel.

Add this Environment Variable in Vercel Project Settings:

    FOOTBALL_DATA_API_KEY

Use the same football-data.org API token currently used locally.

After deployment test:

    /api/v1/health

Then:

    /api/v1/clubs/coventry-city

The Coventry endpoint is deliberately only a proof of the cloud gateway at Stage 2.5a.
The full dashboard aggregation will move into the cloud in Stage 2.5b.

## Local screensaver

The current screensaver remains under:

    apps/sky-blues-screensaver

Its local setup works as before.

This avoids breaking the known-good client while the Vercel backend is being introduced.

## Development principle

From this point forward, Git history replaces numbered folders as the primary source
of version history. Stage names can still be used in commits/tags for milestones.


## Stage 2.5b

The complete Coventry dashboard aggregation logic has now moved into Vercel.

Deploy this commit, then test:

    /api/v1/clubs/coventry-city-dashboard

The JSON should include:

- `nextMatch`
- `featuredMatch`
- `matchState`
- `refreshAfterSeconds`
- `nextThree`
- `cityLast5`
- `opponentLast5`
- `standings`
- `diagnostics`

### Cloud test harness

You can test match states without changing server configuration:

    /api/v1/clubs/coventry-city-dashboard?testState=MATCHDAY

    /api/v1/clubs/coventry-city-dashboard?testState=LIVE&homeScore=1&awayScore=2&minute=67

    /api/v1/clubs/coventry-city-dashboard?testState=FULL_TIME&homeScore=1&awayScore=2

Test-mode responses use `Cache-Control: no-store`.

### Important

The screensaver client has deliberately NOT been migrated yet.

Stage 2.5c will stabilise/refine the cloud JSON contract.
Stage 2.5d will point the installed client at Vercel and remove its need for the
football-data.org API key.

## Stage 2.5c — Cloud Client Migration

The Coventry client now calls the production Vercel dashboard API directly.
It no longer requires localhost:8787, Node.js, config.local.json, or a local
football-data.org API token.

The Vercel dashboard endpoint now includes CORS headers for local/static clients.

## Stage 2.5d — Release hardening

Stage 2.5 is now complete.

2.5d removes the obsolete local Node.js proxy from the distributable client,
adds browser-side last-known-good caching, improves offline/error behaviour, and
marks the Vercel dashboard payload as the stable `dashboard-v1` contract.

The client contains no upstream football-data.org credential.

Next milestone: Stage 2.6 — multi-club platform foundations.

## Stage 2.5e — LIVE reliability and API efficiency

No UI changes.

The Coventry cloud dashboard now makes one broad Coventry match-history request and
derives Last 5, matchday/live detection, Next Match and Next 3 locally.

The opponent's Last 5 is also derived from one broad historical request.

This substantially reduces upstream football-data.org calls during LIVE mode.

Venue fallback no longer depends on a separate match-details request. If the fixture
payload has no venue, the API resolves it from the home-team resource and reuses that
value for the featured LIVE/test fixture.

Diagnostics now include:

    diagnostics.upstream.requestCount
    diagnostics.upstream.requests

A normal dashboard request should typically require about 4 upstream calls:

1. Coventry match history
2. Premier League standings
3. home-team venue, only if venue is missing
4. opponent match history

If the match payload already contains a venue, the count can be lower.

## Stage 2.6a — Generic Club Registry

The cloud API no longer hard-codes Coventry's provider team ID or identity inside
the dashboard aggregation logic.

New shared modules:

    api/v1/_lib/clubs.js
    api/v1/_lib/dashboard.js

`clubs.js` owns club identity/configuration.

`dashboard.js` contains reusable football-data.org aggregation logic.

The Coventry endpoint is now only a thin adapter that resolves:

    getClubConfig("coventry-city")

and passes that configuration into the shared dashboard builder.

The response remains `dashboard-v1`, so the existing Coventry client requires no
changes.

This is intentionally still a one-club registry. Stage 2.6d will add a second club
only after the abstraction is proven.

## Stage 2.6b — Generic Dashboard Routing

The preferred dashboard endpoint is now:

    GET /api/v1/clubs/{club}/dashboard

For Coventry City:

    GET /api/v1/clubs/coventry-city/dashboard

The route resolves `{club}` through the shared club registry and passes the resulting
configuration into the shared dashboard builder.

Unknown clubs return a clean HTTP 404 response.

The previous endpoint remains as a compatibility alias:

    /api/v1/clubs/coventry-city-dashboard

The Coventry client has been updated to use the new generic route.

## Stage 2.6c — Theme & Asset Abstraction

Coventry-specific presentation assets are now packaged as a theme:

    apps/sky-blues-screensaver/themes/sky-blues/
      theme.json
      assets/
        crest.png
        hero.jpg

The generic client loads its theme using the public `config.js` value:

    theme: "sky-blues"

The theme controls:

- club presentation identity
- primary/secondary colours
- panel/background colours
- crest asset
- hero asset

Football identity remains separate in the server-side club registry.

The Coventry screen is intentionally visually unchanged in Stage 2.6c.

## Stage 2.6d — Arsenal multi-club proof

Arsenal has been added to the shared club registry:

    slug: arsenal
    providerTeamId: 57
    themeKey: classic-arsenal

A second client app now exists:

    apps/arsenal-screensaver/

Both Coventry and Arsenal use the same:

- generic `/api/v1/clubs/{club}/dashboard` route;
- shared dashboard engine;
- shared generic client logic;
- matchday/live/full-time behaviour.

Only club configuration and theme assets differ.

A deployed test landing page is available at:

    /apps/

and the Arsenal client at:

    /apps/arsenal-screensaver/index.html

## Stage 2.7a — Unified Club Selector & Generic Client

A new single multi-club client now exists:

    apps/matchday-desktop/

On first run the user chooses a supported club. The choice is remembered in local
browser storage.

Supported clubs are supplied by the cloud API:

    GET /api/v1/clubs

The same client can also be launched directly:

    ?club=coventry-city
    ?club=arsenal

Standalone Coventry and Arsenal builds remain temporarily for compatibility and
regression testing.

## Stage 2.7b — Productisation & Settings

The unified client now includes a discreet Settings panel with:

- club switching;
- 12/24-hour clock preference;
- optional clock seconds;
- cloud API connectivity test;
- installed application version.

User preferences are stored locally and do not require an account.

Product metadata is held in:

    apps/matchday-desktop/app-meta.json

This stage continues the move away from developer-facing configuration toward an
end-user distributable product.

## Stage 3.0a — Windows Application Shell

Matchday Desktop can now run inside an Electron desktop shell rather than a normal
browser window.

Development launch:

    RUN-DESKTOP-DEV.bat

Full-screen launch:

    RUN-DESKTOP-FULLSCREEN.bat

The shell deliberately remains thin. Football data, club catalogue, themes and the
canonical UI continue to come from the deployed Matchday Desktop service.

Desktop controls:

- F11 toggles full screen.
- Escape leaves full screen.
- External links are opened in the user's normal browser.

The Electron renderer has Node integration disabled, context isolation enabled and
sandboxing enabled.

Stage 3.0a is not yet the Windows screensaver implementation. That behaviour belongs
to Stage 3.0b after the application-shell boundary has been proven.

## Stage 3.0b — Windows Screensaver Mode

Test full-screen screensaver mode:

    RUN-SCREENSAVER-MODE.bat

Test screensaver configuration mode:

    RUN-SCREENSAVER-CONFIG.bat

Supported Windows-style arguments:

- `/s` — full-screen screensaver
- `/c` or `/c:HWND` — configuration
- `/p HWND` — preview request

Screensaver mode exits on meaningful mouse movement, mouse click, or key input after
a 1.2-second startup guard.

Build the `.scr` test artifact with:

    BUILD-SCREENSAVER.bat

Output:

    dist/win-unpacked/Matchday Desktop.scr

Keep the `.scr` beside the rest of `win-unpacked`; Stage 3.0c will install/register
it properly.

Windows `/p` preview is intentionally a clean no-op in 3.0b because embedding an
Electron BrowserWindow in a foreign native HWND requires a Win32 native bridge.

## Stage 3.1a — Installer Packaging

Stage 3.1 begins Windows distribution.

The Electron shell can now be packaged as a standard NSIS installer:

    BUILD-INSTALLER.bat

or:

    npm run build:installer

Expected output:

    dist/Matchday-Desktop-Setup-3.1.0.exe

The installer is configured as:

- Windows x64
- interactive installer (not one-click)
- per-user installation
- installation-directory selection enabled
- Desktop shortcut
- Start Menu shortcut
- normal Windows uninstall entry
- launch Matchday Desktop after installation

The existing screensaver test build remains available through:

    BUILD-SCREENSAVER.bat

or build both installer and `.scr` test artifacts using:

    BUILD-RELEASE.bat

### Stage boundary

3.1a packages the application but does NOT yet register Matchday Desktop as a
Windows screensaver automatically.

That registration/install integration belongs to Stage 3.1b.

### Arsenal crest

The Classic Arsenal theme now uses the clean user-supplied crest asset in both:

    apps/arsenal-screensaver/
    apps/matchday-desktop/

No generated or cleaned-up substitute crest is used.

## Stage 3.1b — Windows Screensaver Registration & First Run

First normal launch now opens Settings until Windows integration has been saved.

Settings adds:
- Set Matchday Desktop as the active Windows screensaver.
- Screensaver timeout selection.
- Start Matchday Desktop with Windows.

Before changing the active screensaver, Matchday stores the user's previous
per-user Windows screensaver registry values in its user-data configuration.
Turning Matchday screensaver integration off restores those saved values.

The installer build now creates `Matchday Desktop.scr` inside the packaged app
before NSIS packages the installer.

Desktop background/live wallpaper integration is intentionally deferred to 3.2.

## Stage 3.1b4 — Consolidated Windows Integration

This build consolidates all 3.1b fixes into one package.

The Settings panel no longer silently hides Windows Integration when the Electron
native bridge is unavailable. Instead it displays a diagnostic message asking the
user to reinstall the current Matchday Desktop build.

Before building/installing, run:

    CHECK-3.1B-WINDOWS-INTEGRATION.bat

All four checks should report OK.

The Windows Integration section is part of Config/Settings, not the NSIS installer
wizard itself.

Live desktop/background integration is still intentionally deferred to Stage 3.2.

## Stage 3.1b5 — Windows Bridge Fix

The Windows integration bridge failure was caused by `desktop/preload.js`
referencing `contextBridge` before importing it from Electron.

3.1b5 fixes the preload initialization order and exposes:

    window.matchdayWindows.bridgeVersion = "3.1b5"

Settings polish in this build:

- tighter vertical spacing;
- consistent right-edge alignment for controls;
- Save/Cancel above the version line;
- version moved to the bottom-left;
- less scrolling at normal Config window sizes.

Because `preload.js` is packaged inside Electron, this build requires rebuilding
and reinstalling Matchday Desktop.

## Stage 3.1c — Clean Install / Uninstall Hardening

Changes:

- fixes Windows native dropdown option contrast;
- adds `--uninstall-cleanup` native mode;
- NSIS uninstall invokes Matchday cleanup before removing application files;
- restores the previously saved Windows screensaver configuration;
- removes the Matchday Desktop Windows startup entry;
- removes Matchday's Windows-integration state file;
- adds `CHECK-3.1C-RELEASE.bat`;
- adds a clean-machine acceptance-test checklist.

Build:

    CHECK-3.1C-RELEASE.bat
    BUILD-INSTALLER.bat

Expected installer:

    dist/Matchday-Desktop-Setup-3.1.6.exe

## Stage 3.2a — Experimental Live Desktop Background

Test manually:

    RUN-LIVE-DESKTOP.bat

or:

    npm run desktop:wallpaper

Settings adds:

    Use Matchday Desktop as my live desktop background (Experimental)

When enabled, Matchday registers a Windows startup command using `--wallpaper`.

3.2a is intentionally limited to the primary display. The existing Windows static
wallpaper is not replaced or deleted; it remains underneath Matchday and returns when
Live Desktop mode stops.

## Stage 3.2b — Desktop Z-Order & Icon Visibility Fix

3.2b keeps the working 3.2a click-through desktop attachment and changes the
native Z-order behaviour.

Key change:

    SetWindowPos(..., HWND_BOTTOM, ...)

After parenting Matchday to the Windows desktop host, the Matchday window is now
explicitly pushed to the bottom of that host's sibling Z-order.

Expected visual stack:

    Windows wallpaper
    Matchday Desktop
    Desktop icons
    normal application windows
    taskbar

Run:

    RUN-LIVE-DESKTOP-DIAGNOSTIC.bat

The console reports the selected Windows host and whether WorkerW or Progman was
used. A copy of the diagnostic is also written to:

    %APPDATA%\Matchday Desktop\live-desktop.log

3.2b remains an experimental primary-monitor-only implementation.

## Stage 3.2c — Independent WorkerW Host Fix

Diagnostics from 3.2b showed both the wallpaper host and the icon host resolving to
`Progman`. That explains why Matchday remained visually above the desktop icons.

3.2c no longer accepts Progman as a valid live-wallpaper host.

It explicitly asks Explorer to create the WorkerW wallpaper layer and selects a
WorkerW that does not contain `SHELLDLL_DefView`.

Expected diagnostic result:

    selected=WorkerW
    iconHost=Progman or WorkerW
    selectedHwnd != iconHostHwnd

If no independent WorkerW can be found, 3.2c fails visibly rather than attaching
Matchday to the icon host and obscuring the icons.

The diagnostic launcher now also runs `npm install` automatically when the local
Electron dependency is absent.

## Stage 3.2d — Top-level Z-order + true child fix

3.2c proved that Windows created an independent WorkerW, but Matchday still
visually covered icons because the WorkerW itself remained above the top-level
icon host.

3.2d adds two native corrections:

1. Move the selected WorkerW behind the top-level icon host using SetWindowPos.
2. Convert Electron's window from WS_POPUP to WS_CHILD before SetParent.

Expected diagnostics include:

    selected=WorkerW
    selectedHwnd != iconHostHwnd
    hostOrder=behindIconHost
    childStyle=WS_CHILD
    childZ=HWND_BOTTOM

Test with:

    RUN-LIVE-DESKTOP-DIAGNOSTIC.bat

## Stage 3.2e — Dynamic Windows Wallpaper

3.2e replaces the experimental WorkerW desktop embedding architecture with a
production-oriented dynamic wallpaper renderer.

Architecture:

1. Electron loads the Matchday dashboard in a hidden renderer at primary-display size.
2. `webContents.capturePage()` captures the completed dashboard.
3. The image is saved to the Matchday Desktop user-data wallpaper folder.
4. Windows `SystemParametersInfo(SPI_SETDESKWALLPAPER)` applies it as the genuine
   Windows wallpaper.
5. The first test refreshes every 60 seconds.

Test with:

    RUN-DYNAMIC-WALLPAPER.bat

The old `--wallpaper` WorkerW mode remains in this development package for reference
only. Settings now register `--dynamic-wallpaper` when the desktop-background option
is enabled.

Stage 3.2e is primary-monitor-only. Restoration of the user's previous wallpaper and
adaptive matchday/live refresh rates are intended for the next hardening iteration
after this rendering path is verified.

## Stage 3.2f — Dynamic Wallpaper Time Presentation

3.2f fixes the missing bottom-left clock by explicitly refreshing the clock/date
immediately before every wallpaper capture.

Dynamic wallpaper mode is intentionally minute-granularity:

- bottom-left time/date is captured at the current time;
- countdown seconds are hidden in wallpaper mode;
- days / hours / minutes remain visible;
- wallpaper refresh remains every 60 seconds;
- screensaver mode remains fully live and continues to show seconds.

The hidden wallpaper renderer loads the hosted dashboard with:

    ?wallpaperMode=1

so wallpaper-specific presentation can be handled without affecting desktop-app or
screensaver modes.

## Stage 3.2f1 — Dynamic Wallpaper Readiness / Refresh Fix

Fixes two issues found during 3.2f testing:

1. The pre-capture JavaScript previously declared `const now` at page-global scope.
   Re-running the script on later refreshes could throw a redeclaration error.
   The injected code now runs inside an IIFE with scoped local variables.

2. The first wallpaper capture used a fixed 1.2-second delay and could capture the
   dashboard while fixture/theme/API data was still loading.

The hosted dashboard now exposes:

    window.__MATCHDAY_READY__ = true

after club initialization, theme/data rendering and two animation frames. The hidden
wallpaper renderer waits up to 20 seconds for that explicit signal before capturing.

This means Windows should never receive the temporary "Loading fixture..." frame
during normal successful startup.

## Stage 3.2g — Dynamic Wallpaper Production Hardening

3.2g promotes Dynamic Wallpaper to the production desktop-background architecture.

### Wallpaper preservation

Before Matchday enables Dynamic Wallpaper for the first time, it stores the current
Windows wallpaper path, WallpaperStyle and TileWallpaper values.

When Dynamic Wallpaper is disabled, Matchday restores those original values.

The NSIS uninstall cleanup path also restores the previous wallpaper before Matchday
files are removed.

### Settings lifecycle

Saving Windows Settings with Dynamic Wallpaper enabled starts the hidden wallpaper
renderer immediately and registers:

    Matchday Desktop.exe --dynamic-wallpaper

for Windows startup.

Disabling the option stops the stored wallpaper-renderer process, restores the prior
wallpaper, and removes the wallpaper startup mode when no other startup option is
required.

### Adaptive refresh

Refresh timing is selected from the rendered match state:

    Normal      60 seconds
    Matchday    30 seconds
    Live        15 seconds

The renderer re-evaluates the state after every capture, so the schedule can tighten
automatically as the application enters matchday/live mode.

### WorkerW retired

The experimental WorkerW desktop-embedding path and launchers are removed from the
production package. Dynamic Windows Wallpaper is now the sole desktop-background
architecture.

Run:

    CHECK-3.2G-DYNAMIC-WALLPAPER.bat

before installer testing.

## Stage 3.2g1 — Windows Startup Save Fix

Fixes a malformed PowerShell command used when saving Windows Integration settings
with the startup option disabled.

Windows startup registration now uses `reg.exe` directly instead of building
PowerShell registry commands dynamically.

Also changes the Settings label:

    Show seconds

to:

    Show seconds on screensaver

to make clear that wallpaper mode remains minute-granularity.
