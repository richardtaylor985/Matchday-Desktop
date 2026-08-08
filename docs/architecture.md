# Matchday Desktop Architecture

## Current state

The repository contains two distinct concerns:

1. `apps/sky-blues-screensaver`
   - the working Coventry City client
   - currently still capable of talking to football-data.org through its local Node server

2. `api`
   - the beginning of the cloud gateway
   - deployed to Vercel
   - owns the football-data.org credential

## Target flow

    football-data.org
            |
            v
       Vercel API
            |
            v
     Matchday Desktop
       screensavers

The client should eventually know only our API contract.

## Why this boundary matters

- football-data.org credentials never ship to customers
- API traffic can be cached centrally
- provider-specific response formats stay server-side
- another football provider can replace football-data.org later
- multi-club clients can share one backend
- product access/licensing can later be enforced at our own API boundary

## Stage plan

### 2.5a
Repository + Vercel gateway foundation.

### 2.5b
Move the full Coventry dashboard aggregation logic into Vercel.

### 2.5c
Stabilise `/api/v1/clubs/:club/dashboard` as our product API contract.

### 2.5d
Change the screensaver to consume our Vercel API only.

### 2.6
Generalise club configuration and themes.


## Stage 2.5b cloud dashboard contract

The first complete cloud dashboard endpoint is:

    GET /api/v1/clubs/coventry-city-dashboard

It now owns:

- next fixture lookup
- next 3 fixture selection
- Coventry Last 5
- opponent Last 5
- 2026/27 standings
- venue fallback
- matchday/live/full-time state detection
- adaptive cache guidance
- diagnostics

The screensaver still uses the local server until Stage 2.5d.

## Stage 2.6a club abstraction

    Club Route
       |
       v
    Club Registry
       |
       v
    Shared Dashboard Builder
       |
       v
    football-data.org

Football identity and client theme identity are now represented separately through
`providerTeamId` and `themeKey`.

## Stage 2.6b generic route

    /api/v1/clubs/{club}/dashboard
                 |
                 v
          Club Registry lookup
                 |
          unknown -> 404
                 |
                 v
       Shared Dashboard Builder

The old Coventry-specific route is retained only as a compatibility adapter.

## Stage 2.6c presentation boundary

    Club Registry
       = football identity
       = provider team ID
       = competition/season

    Theme Package
       = colours
       = crest override
       = hero artwork
       = visual identity

The dashboard engine does not own club-specific presentation assets.

## Stage 2.6d multi-club proof

                 Shared API
                    |
            Shared Dashboard Engine
              /             \
             /               \
      Coventry config      Arsenal config
           |                    |
      Sky Blues theme      Classic Arsenal theme
           |                    |
      Coventry client       Arsenal client

The client code is now club-generic. Selected-club identity is resolved from the
dashboard response rather than through Coventry-specific name checks.

## Stage 2.7a distribution model

             Unified Client
                  |
          Club selection
                  |
         /api/v1/clubs
                  |
          club + theme key
                  |
       Generic dashboard route
                  |
        Shared dashboard engine

A new supported club now requires primarily:

1. one server registry entry;
2. one theme package.

A separate client application is no longer architecturally required.
