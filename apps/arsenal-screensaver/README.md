# Arsenal Matchday Screensaver — Stage 2.6d

This is the first second-club proof for Matchday Desktop.

## Run locally

Double-click:

    RUN-SCREENSAVER.bat

The client uses the same generic Matchday Desktop API as Coventry:

    https://matchday-desktop.vercel.app/api/v1/clubs/arsenal/dashboard

## Theme

Classic Arsenal:

- Arsenal red
- white
- gold accent
- deep navy / black panels
- Thierry Henry tribute hero
- local Arsenal crest override

## Test states

Edit `config.js` and set:

    testState: "MATCHDAY"
    testState: "LIVE"
    testState: "FULL_TIME"

Return to real behaviour with:

    testState: null
