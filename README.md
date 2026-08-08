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
