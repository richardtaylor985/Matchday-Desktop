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
