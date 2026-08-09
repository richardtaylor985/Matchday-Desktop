# Stage 3.1c clean-machine test

Use a Windows user account that does not have the Matchday Desktop development
repository in its startup path if possible.

1. Record the current Windows screensaver and timeout.
2. Install `Matchday-Desktop-Setup-3.1.6.exe`.
3. Leave "Launch Matchday Desktop" selected.
4. Choose a club.
5. Enable Matchday Desktop as the Windows screensaver.
6. Set a short timeout and save Windows settings.
7. Close Matchday Desktop and verify Windows launches the Matchday screensaver.
8. Reopen Config and verify settings persist.
9. Uninstall Matchday Desktop through Windows Installed Apps.
10. Confirm the previous screensaver/timeout is restored.
11. Confirm Matchday Desktop no longer launches with Windows.
12. Confirm no Windows screensaver registry value points at the removed Matchday install folder.

Expected result: install, configuration, screensaver launch, persistence and uninstall
all work without Node.js, npm, Git or the project source tree.
