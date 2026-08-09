# Matchday Desktop Installer — Stage 3.1a

## Build prerequisites

- Windows
- Node.js 22.x
- npm dependencies installed

## Build installer

From the repository root:

    BUILD-INSTALLER.bat

or:

    npm run build:installer

Expected artifact:

    dist\Matchday-Desktop-Setup-3.1.0.exe

## What the installer does in 3.1a

- installs the Electron Matchday Desktop shell;
- creates a Desktop shortcut;
- creates a Start Menu shortcut;
- creates a normal Windows uninstall entry;
- optionally launches Matchday Desktop when setup completes.

## What it deliberately does not do yet

- register or copy the `.scr` into Windows screensaver locations;
- modify Windows screensaver registry settings;
- make Matchday Desktop the active Windows screensaver.

Those are Stage 3.1b responsibilities.
