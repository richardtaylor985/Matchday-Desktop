# Matchday Desktop — Stage 2.7a Unified Client

This is the first single distributable client for multiple clubs.

## Run

Double-click:

    RUN-MATCHDAY-DESKTOP.bat

On first launch, choose a supported club.

The selection is remembered locally.

To switch clubs, use the discreet `CHANGE CLUB` control in the bottom-right corner.

## Direct club launch

You can also launch directly with a query parameter:

    index.html?club=coventry-city
    index.html?club=arsenal

## Supported clubs

The selector reads the supported club list from:

    https://matchday-desktop.vercel.app/api/v1/clubs

The football dashboard still uses:

    /api/v1/clubs/{club}/dashboard

## Current themes

- Coventry City -> sky-blues
- Arsenal -> classic-arsenal

The existing standalone Coventry and Arsenal apps remain in the repository for
compatibility and regression testing.
