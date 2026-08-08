# Matchday Desktop Windows Shell — Stage 3.0a

## Prerequisites for development

Install Node.js on the development PC.

## First test

From the repository root, double-click:

    RUN-DESKTOP-DEV.bat

The first run installs Electron dependencies and then opens Matchday Desktop in a
normal resizable desktop window.

## Full-screen test

Double-click:

    RUN-DESKTOP-FULLSCREEN.bat

The application launches full-screen without normal browser chrome.

Controls:

- F11: toggle full screen
- Escape: leave full screen

## Architecture

The Windows executable is intentionally a thin shell around the canonical hosted
Matchday Desktop client. This means football data and supported-club presentation can
continue to evolve server-side without requiring a new Windows executable for every
content update.

Stage 3.0b will add genuine screensaver invocation and dismissal behaviour.
