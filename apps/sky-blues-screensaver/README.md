# Sky Blues Screensaver — Stage 2.5c Cloud Client

Run `RUN-SCREENSAVER.bat`.

The client now calls:

    https://matchday-desktop.vercel.app/api/v1/clubs/coventry-city-dashboard

No Node.js process or football-data.org API key is required on the client PC.

## Test states

Edit `config.js` and set `testState` to MATCHDAY, LIVE, FULL_TIME, or null.
For LIVE/FULL_TIME, `testHomeScore`, `testAwayScore` and `testMinute` are available.
