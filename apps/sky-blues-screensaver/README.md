# Sky Blues Screensaver — Stage 2.5d

Stage 2.5d completes the cloud migration and release-hardening pass.

## Run

Double-click:

    RUN-SCREENSAVER.bat

The client talks directly to the production Matchday Desktop API:

    https://matchday-desktop.vercel.app/api/v1/clubs/coventry-city-dashboard

No Node.js server and no football-data.org API key are required on the client PC.

## Offline behaviour

Every successful dashboard response is saved locally in the browser.

If the cloud API later becomes unavailable, the screensaver displays the last
known dashboard and clearly labels it:

    OFFLINE • LAST KNOWN DATA • <AGE>

If the client has never received a successful response, it displays:

    OFFLINE • NO CACHED DATA

## API contract

The cloud endpoint now identifies the stable Stage 2 dashboard contract as:

    dashboard-v1

This gives future clients a stable contract while the server implementation can
continue to evolve.

## Test states

Edit `config.js` and set `testState` to:

- "MATCHDAY"
- "LIVE"
- "FULL_TIME"
- null

`null` restores normal automatic behaviour.

## Stage 2.5e

No client visual changes are required. LIVE venue and Last 5 reliability are fixed
server-side through the optimized Matchday Desktop API.

## Stage 2.6c theme package

The existing Coventry appearance now comes from `themes/sky-blues/theme.json`.
No visual redesign is intended; this is an architectural refactor only.
