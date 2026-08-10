# Matchday Desktop 3.2i Acceptance Test

## Install / first run
1. Record the user's existing Windows wallpaper and screensaver settings.
2. Install Matchday Desktop with the release installer.
3. Leave Launch Matchday Desktop selected.
4. Confirm Settings opens on first run.
5. Choose Coventry City or Arsenal and return to Settings.
6. Save once; confirm display and Windows integration options are committed together.

## Screensaver
1. Enable Matchday as Windows screensaver.
2. Test 5-minute timeout; reopen Settings and confirm status reports 5 min.
3. Test 10-minute timeout; reopen Settings and confirm status reports 10 min.
4. Repeat for 15 and 30 minutes.
5. Enable Show seconds on screensaver and confirm seconds tick on every monitor.
6. Disable Show seconds and confirm every monitor shows HH:MM only.
7. Confirm mouse/keyboard activity on either display dismisses the screensaver.

## Dynamic wallpaper
1. Enable Dynamic Windows Wallpaper.
2. Confirm current club applies without toggling another integration setting.
3. Switch Coventry -> Arsenal -> Coventry and confirm each wallpaper changes automatically.
4. Confirm desktop icons remain native and usable.
5. Confirm no bottom-edge crop is visible.
6. Leave renderer running through at least two refresh cycles.

## Startup / restart
1. Enable Start Matchday Desktop automatically with Windows.
2. Sign out/restart and confirm the configured behaviour resumes.
3. Reopen Settings and confirm club/integration state persisted.

## Upgrade
1. Install this build over an existing Matchday installation.
2. Confirm selected club and settings survive.
3. Confirm screensaver and wallpaper still operate.

## Disable / uninstall
1. Disable Dynamic Wallpaper and confirm the user's previous wallpaper is restored.
2. Disable Matchday screensaver and confirm previous screensaver values are restored.
3. Re-enable both, then uninstall Matchday.
4. Confirm previous wallpaper/screensaver are restored.
5. Confirm the Matchday startup registry entry is removed.
6. Confirm Windows does not reference a removed Matchday .scr file.

## Release gate
RC1 requires every item above to pass without source-tree, Node.js, npm, Git,
PowerShell console work, or manual registry editing by the end user.
