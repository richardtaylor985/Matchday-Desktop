# Sky Blues Screensaver — Stage 2.4e

Stage 2.4e adds a configurable Matchday Test Mode to the Stage 2.4 match-state engine.

## Test Mode

Edit your local:

    config.local.json

and add:

    "testMode": {
      "enabled": true,
      "state": "MATCHDAY",
      "homeScore": 1,
      "awayScore": 2,
      "minute": 67
    }

Valid states are:

- NORMAL
- MATCHDAY
- LIVE
- FULL_TIME

Then restart `RUN-SCREENSAVER.bat`.

## Examples

### Test Matchday

    "testMode": {
      "enabled": true,
      "state": "MATCHDAY",
      "homeScore": 0,
      "awayScore": 0,
      "minute": 0
    }

Expected behaviour:

- top heading changes to MATCHDAY;
- countdown label becomes KICK-OFF IN;
- TODAY banner is shown;
- matchday refresh cadence is selected.

### Test Live

    "testMode": {
      "enabled": true,
      "state": "LIVE",
      "homeScore": 1,
      "awayScore": 2,
      "minute": 67
    }

Expected behaviour:

- heading becomes LIVE MATCH;
- score shows 1–2;
- status shows 67';
- five-minute refresh cadence is selected.

### Test Full Time

    "testMode": {
      "enabled": true,
      "state": "FULL_TIME",
      "homeScore": 1,
      "awayScore": 2,
      "minute": 90
    }

Expected behaviour:

- heading becomes FULL TIME;
- final score shows 1–2;
- full-time refresh cadence is selected.

### Return to real automatic behaviour

Set:

    "enabled": false

The screensaver will then derive its state entirely from real football-data.org data.

## Safety / distribution

Test Mode is server-side. It does not alter football-data.org data or write anything
back to the provider.

The bottom-right status shows `TEST MODE • <STATE>` while simulation is active so a
test display cannot easily be mistaken for a real live score.

Your API key remains local and is excluded from this project ZIP.

## Preserved

All Stage 2.4 functionality and visuals are preserved, including:

- approved artwork;
- hero positioning;
- 41px countdown;
- Last 5;
- Next 3;
- standings;
- crest constraints;
- match-state engine;
- adaptive refresh;
- venue fallback;
- diagnostics.
