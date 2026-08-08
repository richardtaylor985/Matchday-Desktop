const API_BASE = "https://api.football-data.org/v4";
const PREMIER_LEAGUE_SEASON = 2026;
const PREVIOUS_SEASON = PREMIER_LEAGUE_SEASON - 1;
const COVENTRY_PROVIDER_ID = 1076;

function isoDate(date) {
  return date.toISOString().slice(0, 10);
}

function todayUtcDate() {
  const now = new Date();
  return new Date(Date.UTC(
    now.getUTCFullYear(),
    now.getUTCMonth(),
    now.getUTCDate()
  ));
}

async function footballApi(path, requestLog) {
  const token = process.env.FOOTBALL_DATA_API_KEY;

  if (!token) {
    throw new Error("FOOTBALL_DATA_API_KEY is not configured");
  }

  const startedAt = Date.now();
  const response = await fetch(`${API_BASE}${path}`, {
    headers: {
      "X-Auth-Token": token
    }
  });

  if (requestLog) {
    requestLog.push({
      endpoint: path,
      status: response.status,
      durationMs: Date.now() - startedAt
    });
  }

  if (!response.ok) {
    const body = await response.text();
    throw new Error(
      `football-data.org ${response.status}: ${body.slice(0, 250)}`
    );
  }

  return response.json();
}

function normaliseMatch(match, teamId) {
  const isHome = match.homeTeam?.id === teamId;
  const fullTime = match.score?.fullTime || {};
  const regularTime = match.score?.regularTime || {};

  const homeScore =
    Number.isFinite(fullTime.home) ? fullTime.home :
    Number.isFinite(regularTime.home) ? regularTime.home :
    null;

  const awayScore =
    Number.isFinite(fullTime.away) ? fullTime.away :
    Number.isFinite(regularTime.away) ? regularTime.away :
    null;

  const teamScore = isHome ? homeScore : awayScore;
  const oppScore = isHome ? awayScore : homeScore;

  let outcome = null;
  if (Number.isFinite(teamScore) && Number.isFinite(oppScore)) {
    outcome =
      teamScore > oppScore ? "W" :
      teamScore < oppScore ? "L" : "D";
  }

  const opponent = isHome ? match.awayTeam : match.homeTeam;

  return {
    id: match.id,
    utcDate: match.utcDate,
    status: match.status,
    competition: match.competition?.name || "",
    competitionCode: match.competition?.code || "",
    venue: match.venue || "",
    isHome,
    homeAway: isHome ? "H" : "A",
    teamScore,
    oppScore,
    homeScore,
    awayScore,
    minute: match.minute ?? null,
    outcome,
    opponent: {
      id: opponent?.id,
      name: opponent?.shortName || opponent?.name || "",
      crest: opponent?.crest || ""
    },
    homeTeam: {
      id: match.homeTeam?.id,
      name: match.homeTeam?.shortName || match.homeTeam?.name || "",
      crest: match.homeTeam?.crest || ""
    },
    awayTeam: {
      id: match.awayTeam?.id,
      name: match.awayTeam?.shortName || match.awayTeam?.name || "",
      crest: match.awayTeam?.crest || ""
    }
  };
}

function dedupeMatches(matches) {
  const seen = new Set();

  return matches.filter(match => {
    const key =
      match.id ||
      `${match.utcDate}-${match.homeTeam?.id}-${match.awayTeam?.id}`;

    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

async function getTeamMatchHistory(teamId, dateFrom, dateTo, requestLog) {
  const endpoint =
    `/teams/${teamId}/matches` +
    `?dateFrom=${dateFrom}` +
    `&dateTo=${dateTo}` +
    `&limit=100`;

  const data = await footballApi(endpoint, requestLog);

  return {
    endpoint,
    matches: (data.matches || []).map(m => normaliseMatch(m, teamId))
  };
}

function getLastFiveFromHistory(matches) {
  return dedupeMatches(matches)
    .filter(m =>
      m.status === "FINISHED" &&
      Number.isFinite(m.teamScore) &&
      Number.isFinite(m.oppScore)
    )
    .sort((a, b) => new Date(b.utcDate) - new Date(a.utcDate))
    .slice(0, 5);
}

function getUpcomingFromHistory(matches) {
  const allowedStatuses = new Set([
    "SCHEDULED",
    "TIMED",
    "POSTPONED"
  ]);

  const now = new Date();

  return matches
    .filter(m => allowedStatuses.has(m.status))
    .filter(m => new Date(m.utcDate) >= now)
    .sort((a, b) => new Date(a.utcDate) - new Date(b.utcDate));
}

function getMatchdayWindowFromHistory(matches) {
  const now = new Date();

  const start = new Date(now);
  start.setUTCDate(start.getUTCDate() - 1);

  const end = new Date(now);
  end.setUTCDate(end.getUTCDate() + 1);

  return matches.filter(m => {
    const kickoff = new Date(m.utcDate);
    return kickoff >= start && kickoff <= end;
  });
}

async function getStandings(requestLog) {
  const data = await footballApi(
    `/competitions/PL/standings?season=${PREMIER_LEAGUE_SEASON}`,
    requestLog
  );

  const total =
    (data.standings || []).find(s => s.type === "TOTAL") ||
    data.standings?.[0];

  const rows = (total?.table || []).map(row => ({
    pos: row.position,
    team: row.team?.shortName || row.team?.name || "",
    teamId: row.team?.id,
    crest: row.team?.crest || "",
    p: row.playedGames,
    w: row.won,
    d: row.draw,
    l: row.lost,
    gd: row.goalDifference,
    pts: row.points
  }));

  const hasCoventry = rows.some(row =>
    /coventry city/i.test(row.team)
  );

  return hasCoventry ? rows : [];
}

async function resolveVenue(match, requestLog, teamCache) {
  if (!match) return match;
  if (match.venue) return match;

  const homeTeamId = match.homeTeam?.id;
  if (!homeTeamId) return match;

  try {
    let homeTeam = teamCache.get(homeTeamId);

    if (!homeTeam) {
      homeTeam = await footballApi(`/teams/${homeTeamId}`, requestLog);
      teamCache.set(homeTeamId, homeTeam);
    }

    return {
      ...match,
      venue: homeTeam.venue || ""
    };
  } catch {
    return match;
  }
}

function isLiveStatus(status) {
  return new Set([
    "IN_PLAY",
    "PAUSED",
    "EXTRA_TIME",
    "PENALTY_SHOOTOUT"
  ]).has(status);
}

function determineMatchState(matchdayMatches, nextMatch) {
  const now = new Date();

  const live = (matchdayMatches || [])
    .filter(m => isLiveStatus(m.status))
    .sort((a, b) => new Date(a.utcDate) - new Date(b.utcDate))[0];

  if (live) {
    return {
      mode: "LIVE",
      featuredMatch: live,
      refreshAfterSeconds: 300
    };
  }

  const recentFinished = (matchdayMatches || [])
    .filter(m => m.status === "FINISHED")
    .filter(m => {
      const kickoff = new Date(m.utcDate);
      const assumedFinish =
        new Date(kickoff.getTime() + 2 * 60 * 60 * 1000);
      const ageMs = now - assumedFinish;

      return ageMs >= 0 &&
        ageMs <= 6 * 60 * 60 * 1000;
    })
    .sort((a, b) => new Date(b.utcDate) - new Date(a.utcDate))[0];

  if (recentFinished) {
    return {
      mode: "FULL_TIME",
      featuredMatch: recentFinished,
      refreshAfterSeconds: 900
    };
  }

  if (nextMatch) {
    const diffMs = new Date(nextMatch.utcDate) - now;

    if (diffMs >= 0 && diffMs <= 6 * 60 * 60 * 1000) {
      return {
        mode: "MATCHDAY",
        featuredMatch: nextMatch,
        refreshAfterSeconds: 900
      };
    }
  }

  return {
    mode: "NORMAL",
    featuredMatch: nextMatch,
    refreshAfterSeconds: 3600
  };
}

function getTestMode(req) {
  const raw = String(req.query?.testState || "").toUpperCase();

  if (!raw) return null;

  const allowed = new Set([
    "NORMAL",
    "MATCHDAY",
    "LIVE",
    "FULL_TIME"
  ]);

  if (!allowed.has(raw)) return null;

  return {
    state: raw,
    homeScore: Number(req.query?.homeScore ?? 1),
    awayScore: Number(req.query?.awayScore ?? 2),
    minute: Number(req.query?.minute ?? 67)
  };
}

function applyTestMode(matchState, nextMatch, req) {
  const test = getTestMode(req);

  if (!test) return matchState;

  const featuredMatch = {
    ...nextMatch,
    status:
      test.state === "LIVE" ? "IN_PLAY" :
      test.state === "FULL_TIME" ? "FINISHED" :
      nextMatch.status,
    homeScore:
      ["LIVE", "FULL_TIME"].includes(test.state)
        ? test.homeScore
        : nextMatch.homeScore,
    awayScore:
      ["LIVE", "FULL_TIME"].includes(test.state)
        ? test.awayScore
        : nextMatch.awayScore,
    minute:
      test.state === "LIVE" ? test.minute : null
  };

  return {
    mode: test.state,
    featuredMatch,
    refreshAfterSeconds:
      test.state === "LIVE" ? 300 :
      test.state === "MATCHDAY" ? 900 :
      test.state === "FULL_TIME" ? 900 :
      3600,
    testMode: true
  };
}

async function buildDashboard(req) {
  const requestLog = [];
  const teamCache = new Map();
  const today = todayUtcDate();

  // One Coventry history call now supplies:
  // - previous/current Last 5
  // - matchday/live detection
  // - next match
  // - Next 3
  const cityHistoryStart = new Date(Date.UTC(PREVIOUS_SEASON, 6, 1));
  const cityHistoryEnd = new Date(Date.UTC(PREMIER_LEAGUE_SEASON + 1, 5, 30));

  const [cityHistoryResult, standings] = await Promise.all([
    getTeamMatchHistory(
      COVENTRY_PROVIDER_ID,
      isoDate(cityHistoryStart),
      isoDate(cityHistoryEnd),
      requestLog
    ),
    getStandings(requestLog)
  ]);

  const cityHistory = cityHistoryResult.matches;
  const futureFixtures = getUpcomingFromHistory(cityHistory);
  const cityLast5 = getLastFiveFromHistory(cityHistory);
  const matchdayMatches = getMatchdayWindowFromHistory(cityHistory);

  const next = futureFixtures[0];

  if (!next) {
    throw new Error("No future Coventry City fixture was returned.");
  }

  const nextMatch = await resolveVenue(next, requestLog, teamCache);

  const naturalMatchState =
    determineMatchState(matchdayMatches, nextMatch);

  const matchState =
    applyTestMode(naturalMatchState, nextMatch, req);

  let featuredMatch = matchState.featuredMatch;

  // Preserve simulated scores in test mode, but still carry the known venue.
  if (matchState.testMode) {
    featuredMatch = {
      ...featuredMatch,
      venue: featuredMatch.venue || nextMatch.venue || ""
    };
  } else {
    featuredMatch = await resolveVenue(
      featuredMatch,
      requestLog,
      teamCache
    );
  }

  const featuredOpponent =
    featuredMatch?.opponent?.id
      ? featuredMatch.opponent
      : nextMatch.opponent;

  // One opponent-history call supplies the complete Last 5.
  const opponentHistoryStart =
    new Date(Date.UTC(PREVIOUS_SEASON, 6, 1));

  const opponentHistoryResult = await getTeamMatchHistory(
    featuredOpponent.id,
    isoDate(opponentHistoryStart),
    isoDate(today),
    requestLog
  );

  const opponentLast5 =
    getLastFiveFromHistory(opponentHistoryResult.matches);

  const warnings = [];

  if (cityLast5.length < 5) {
    warnings.push(
      `Coventry form returned ${cityLast5.length}/5 matches`
    );
  }

  if (opponentLast5.length < 5) {
    warnings.push(
      `${featuredOpponent.name} form returned ` +
      `${opponentLast5.length}/5 matches`
    );
  }

  return {
    service: "matchday-desktop-api",
    version: "2.5e",
    contract: "dashboard-v1",
    club: "coventry-city",
    generatedAt: new Date().toISOString(),
    season: PREMIER_LEAGUE_SEASON,

    city: {
      id: COVENTRY_PROVIDER_ID,
      name: "Coventry City"
    },

    nextMatch,
    featuredMatch,
    matchState: matchState.mode,
    testModeActive: matchState.testMode === true,
    refreshAfterSeconds: matchState.refreshAfterSeconds,

    nextThree: futureFixtures.slice(1, 4),

    cityLast5,
    opponentLast5,
    standings,
    warnings,

    diagnostics: {
      upstream: {
        requestCount: requestLog.length,
        requests: requestLog
      },
      cityHistory: {
        endpoint: cityHistoryResult.endpoint,
        totalMatches: cityHistory.length,
        lastFiveUsable: cityLast5.length,
        futureUsable: futureFixtures.length,
        matchdayWindowMatches: matchdayMatches.length
      },
      opponentHistory: {
        endpoint: opponentHistoryResult.endpoint,
        totalMatches: opponentHistoryResult.matches.length,
        lastFiveUsable: opponentLast5.length
      },
      matchday: {
        mode: matchState.mode,
        testModeActive: matchState.testMode === true,
        refreshAfterSeconds: matchState.refreshAfterSeconds,
        featuredMatchId: featuredMatch?.id || null,
        featuredMatchStatus: featuredMatch?.status || null,
        venue: featuredMatch?.venue || null
      }
    }
  };
}

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  res.setHeader("X-Matchday-Contract", "dashboard-v1");

  if (req.method === "OPTIONS") {
    return res.status(204).end();
  }

  if (req.method !== "GET") {
    return res.status(405).json({
      service: "matchday-desktop-api",
      version: "2.5e",
      error: "Method not allowed"
    });
  }

  try {
    const data = await buildDashboard(req);

    const ttl = Math.max(
      60,
      data.refreshAfterSeconds || 3600
    );

    res.setHeader(
      "Cache-Control",
      data.testModeActive
        ? "no-store"
        : `s-maxage=${ttl}, stale-while-revalidate=${ttl * 2}`
    );

    return res.status(200).json(data);
  } catch (error) {
    return res.status(500).json({
      service: "matchday-desktop-api",
      version: "2.5e",
      contract: "dashboard-v1",
      club: "coventry-city",
      error: error.message
    });
  }
}
