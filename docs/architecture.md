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
