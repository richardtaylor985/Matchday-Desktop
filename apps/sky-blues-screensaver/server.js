const http = require("http");
const fs = require("fs");
const path = require("path");

const PORT = 8787;
const ROOT = __dirname;
const CONFIG_PATH = path.join(ROOT, "config.local.json");
const CACHE_DIR = path.join(ROOT, "cache");
const API_BASE = "https://api.football-data.org/v4";

const CACHE_TTL_MS = 60 * 60 * 1000;
const PREMIER_LEAGUE_SEASON = 2026; // 2026/27
const PREVIOUS_SEASON = PREMIER_LEAGUE_SEASON - 1;
const DASHBOARD_CACHE_VERSION = "v24e";

if (!fs.existsSync(CACHE_DIR)) {
  fs.mkdirSync(CACHE_DIR, { recursive: true });
}

function loadConfig() {
  if (!fs.existsSync(CONFIG_PATH)) return null;
  try {
    return JSON.parse(fs.readFileSync(CONFIG_PATH, "utf8"));
  } catch {
    return null;
  }
}

function json(res, status, data) {
  const body = JSON.stringify(data);
  res.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store"
  });
  res.end(body);
}

function text(res, status, body, contentType = "text/plain; charset=utf-8") {
  res.writeHead(status, { "Content-Type": contentType });
  res.end(body);
}

function safeCacheName(key) {
  return key.replace(/[^a-zA-Z0-9_-]/g, "_");
}

function cacheFile(key) {
  return path.join(CACHE_DIR, safeCacheName(key) + ".json");
}

function readCacheRecord(key) {
  const file = cacheFile(key);
  if (!fs.existsSync(file)) return null;

  try {
    const parsed = JSON.parse(fs.readFileSync(file, "utf8"));
    return parsed;
  } catch {
    return null;
  }
}

function readCache(key) {
  const parsed = readCacheRecord(key);
  if (!parsed) return null;
  if (Date.now() - parsed.savedAt > CACHE_TTL_MS) return null;
  return parsed.data;
}

function readStaleCache(key) {
  const parsed = readCacheRecord(key);
  return parsed?.data || null;
}

function writeCache(key, data) {
  fs.writeFileSync(cacheFile(key), JSON.stringify({
    savedAt: Date.now(),
    data
  }, null, 2));
}

async function footballApi(endpoint) {
  const config = loadConfig();

  if (
    !config ||
    !config.footballDataApiKey ||
    config.footballDataApiKey.includes("PASTE-")
  ) {
    throw new Error("API key not configured");
  }

  const response = await fetch(API_BASE + endpoint, {
    headers: {
      "X-Auth-Token": config.footballDataApiKey
    }
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(
      `football-data.org ${response.status}: ${body.slice(0, 250)}`
    );
  }

  return response.json();
}

async function cachedApi(key, endpoint) {
  const cached = readCache(key);
  if (cached) return cached;

  const data = await footballApi(endpoint);
  writeCache(key, data);
  return data;
}

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

async function findCoventryTeam() {
  const data = await cachedApi(
    `pl_teams_${PREMIER_LEAGUE_SEASON}`,
    `/competitions/PL/teams?season=${PREMIER_LEAGUE_SEASON}`
  );

  const teams = data.teams || [];
  const team = teams.find(t =>
    /coventry city/i.test(t.name || "") ||
    /coventry/i.test(t.shortName || "")
  );

  if (!team) {
    throw new Error(
      "Coventry City was not found in the 2026/27 Premier League team list."
    );
  }

  return team;
}

async function getTeam(teamId) {
  return cachedApi(`team_resource_${teamId}`, `/teams/${teamId}`);
}

function normaliseMatch(match, teamId) {
  const isHome = match.homeTeam?.id === teamId;
  const fullTime = match.score?.fullTime || {};
  const liveScore = match.score || {};

  // football-data.org may populate fullTime only at FT, while live/current
  // score values can be represented through the score resource.
  const homeScore =
    Number.isFinite(fullTime.home) ? fullTime.home :
    Number.isFinite(liveScore.home) ? liveScore.home :
    Number.isFinite(liveScore.regularTime?.home) ? liveScore.regularTime.home :
    null;

  const awayScore =
    Number.isFinite(fullTime.away) ? fullTime.away :
    Number.isFinite(liveScore.away) ? liveScore.away :
    Number.isFinite(liveScore.regularTime?.away) ? liveScore.regularTime.away :
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
    const key = match.id || `${match.utcDate}-${match.homeTeam?.id}-${match.awayTeam?.id}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

async function getMatchesByDateWindow(teamId, dateFrom, dateTo, status, diagnostics = null) {
  const key = `team_${teamId}_${status}_${dateFrom}_${dateTo}`;

  const endpoint =
    `/teams/${teamId}/matches` +
    `?dateFrom=${dateFrom}` +
    `&dateTo=${dateTo}` +
    `&status=${encodeURIComponent(status)}` +
    `&limit=100`;

  try {
    const data = await cachedApi(key, endpoint);
    const matches = data.matches || [];

    if (diagnostics) {
      diagnostics.push({
        teamId,
        dateFrom,
        dateTo,
        status,
        endpoint,
        returnedMatches: matches.length,
        result: "ok"
      });
    }

    return matches.map(m => normaliseMatch(m, teamId));
  } catch (err) {
    if (diagnostics) {
      diagnostics.push({
        teamId,
        dateFrom,
        dateTo,
        status,
        endpoint,
        returnedMatches: 0,
        result: "error",
        error: err.message
      });
    }

    throw err;
  }
}

async function getMatchesByDateWindowAnyStatus(teamId, dateFrom, dateTo, diagnostics = null) {
  const key = `team_${teamId}_all_${dateFrom}_${dateTo}`;

  const endpoint =
    `/teams/${teamId}/matches` +
    `?dateFrom=${dateFrom}` +
    `&dateTo=${dateTo}` +
    `&limit=100`;

  try {
    const data = await cachedApi(key, endpoint);
    const matches = data.matches || [];

    if (diagnostics) {
      diagnostics.push({
        teamId,
        dateFrom,
        dateTo,
        status: "ANY",
        endpoint,
        returnedMatches: matches.length,
        returnedStatuses: [...new Set(matches.map(m => m.status).filter(Boolean))],
        result: "ok"
      });
    }

    return matches.map(m => normaliseMatch(m, teamId));
  } catch (err) {
    if (diagnostics) {
      diagnostics.push({
        teamId,
        dateFrom,
        dateTo,
        status: "ANY",
        endpoint,
        returnedMatches: 0,
        result: "error",
        error: err.message
      });
    }

    throw err;
  }
}

async function getUpcomingMatches(teamId) {
  const today = todayUtcDate();
  const end = new Date(Date.UTC(PREMIER_LEAGUE_SEASON + 1, 5, 30));
  const diagnostics = [];

  const allMatches = await getMatchesByDateWindowAnyStatus(
    teamId,
    isoDate(today),
    isoDate(end),
    diagnostics
  );

  const allowedStatuses = new Set([
    "SCHEDULED",
    "TIMED",
    "POSTPONED"
  ]);

  const upcoming = allMatches
    .filter(m => allowedStatuses.has(m.status))
    .filter(m => new Date(m.utcDate) >= new Date())
    .sort((a, b) => new Date(a.utcDate) - new Date(b.utcDate));

  return {
    matches: upcoming,
    diagnostics: {
      request: diagnostics,
      totalReturned: allMatches.length,
      futureUsable: upcoming.length,
      usableStatuses: [...new Set(upcoming.map(m => m.status))],
      selectedPreview: upcoming.slice(0, 4).map(m => ({
        id: m.id,
        utcDate: m.utcDate,
        status: m.status,
        homeTeam: m.homeTeam?.name,
        awayTeam: m.awayTeam?.name
      }))
    }
  };
}

async function getLastFive(teamId) {
  const today = todayUtcDate();
  const diagnostics = [];

  const currentStart = new Date(Date.UTC(PREMIER_LEAGUE_SEASON, 6, 1));
  const previousStart = new Date(Date.UTC(PREVIOUS_SEASON, 6, 1));
  const previousEnd = new Date(Date.UTC(PREMIER_LEAGUE_SEASON, 5, 30));

  let current = [];
  let previous = [];
  const warnings = [];

  try {
    if (today >= currentStart) {
      current = await getMatchesByDateWindow(
        teamId,
        isoDate(currentStart),
        isoDate(today),
        "FINISHED",
        diagnostics
      );
    }
  } catch (err) {
    warnings.push(`current-season form: ${err.message}`);
  }

  if (current.length < 5) {
    try {
      previous = await getMatchesByDateWindow(
        teamId,
        isoDate(previousStart),
        isoDate(previousEnd),
        "FINISHED",
        diagnostics
      );
    } catch (err) {
      warnings.push(`previous-season form: ${err.message}`);
    }
  }

  const matches = dedupeMatches([...current, ...previous])
    .filter(m =>
      m.status === "FINISHED" &&
      Number.isFinite(m.teamScore) &&
      Number.isFinite(m.oppScore)
    )
    .sort((a, b) => new Date(b.utcDate) - new Date(a.utcDate))
    .slice(0, 5);

  return {
    matches,
    warnings,
    diagnostics: {
      teamId,
      currentReturned: current.length,
      previousReturned: previous.length,
      finalUsable: matches.length,
      requests: diagnostics
    }
  };
}

async function enrichNextMatch(match) {
  let venue = match.venue || "";

  // The team match-list response can omit venue. The single-match resource
  // usually carries the fuller fixture representation.
  if (!venue && match.id) {
    try {
      const details = await cachedApi(
        `match_details_${match.id}`,
        `/matches/${match.id}`
      );
      venue = details.venue || venue;
    } catch {
      // Fall through to home-team venue.
    }
  }

  // Final fallback: the home team's resource normally has its stadium name.
  if (!venue && match.homeTeam?.id) {
    try {
      const homeTeam = await getTeam(match.homeTeam.id);
      venue = homeTeam.venue || venue;
    } catch {
      // Keep blank; UI will show "Venue TBC".
    }
  }

  return { ...match, venue };
}

async function getMatchdayWindow(teamId) {
  const now = new Date();

  const start = new Date(now);
  start.setUTCDate(start.getUTCDate() - 1);

  const end = new Date(now);
  end.setUTCDate(end.getUTCDate() + 1);

  return getMatchesByDateWindowAnyStatus(
    teamId,
    isoDate(start),
    isoDate(end)
  );
}

function isLiveStatus(status) {
  return new Set([
    "IN_PLAY",
    "PAUSED",
    "EXTRA_TIME",
    "PENALTY_SHOOTOUT"
  ]).has(status);
}

function getTestMode() {
  const config = loadConfig();
  const test = config?.testMode;

  if (!test || test.enabled !== true) {
    return null;
  }

  const allowedStates = new Set([
    "NORMAL",
    "MATCHDAY",
    "LIVE",
    "FULL_TIME"
  ]);

  const state = String(test.state || "").toUpperCase();

  if (!allowedStates.has(state)) {
    console.warn(
      `[2.4e] Ignoring invalid testMode.state "${test.state}". ` +
      `Use NORMAL, MATCHDAY, LIVE or FULL_TIME.`
    );
    return null;
  }

  return {
    state,
    homeScore: Number.isFinite(Number(test.homeScore))
      ? Number(test.homeScore)
      : 1,
    awayScore: Number.isFinite(Number(test.awayScore))
      ? Number(test.awayScore)
      : 2,
    minute: Number.isFinite(Number(test.minute))
      ? Number(test.minute)
      : 67
  };
}

function applyTestMode(matchState, nextMatch) {
  const test = getTestMode();

  if (!test) {
    return matchState;
  }

  const featuredMatch = {
    ...nextMatch,
    status:
      test.state === "LIVE" ? "IN_PLAY" :
      test.state === "FULL_TIME" ? "FINISHED" :
      nextMatch.status,
    homeScore:
      test.state === "LIVE" || test.state === "FULL_TIME"
        ? test.homeScore
        : nextMatch.homeScore,
    awayScore:
      test.state === "LIVE" || test.state === "FULL_TIME"
        ? test.awayScore
        : nextMatch.awayScore,
    minute:
      test.state === "LIVE"
        ? test.minute
        : null
  };

  const refreshAfterSeconds =
    test.state === "LIVE" ? 300 :
    test.state === "MATCHDAY" ? 900 :
    test.state === "FULL_TIME" ? 900 :
    3600;

  console.log(
    `[2.4e] TEST MODE ACTIVE: ${test.state}` +
    (test.state === "LIVE"
      ? ` (${test.homeScore}-${test.awayScore}, ${test.minute}')`
      : "")
  );

  return {
    mode: test.state,
    featuredMatch,
    refreshAfterSeconds,
    testMode: true
  };
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
      // Approximate a 2h fixture window, then keep FT visible for a further 6h.
      const assumedFinish = new Date(kickoff.getTime() + 2 * 60 * 60 * 1000);
      const ageMs = now - assumedFinish;
      return ageMs >= 0 && ageMs <= 6 * 60 * 60 * 1000;
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

async function getStandings() {
  const data = await cachedApi(
    `pl_standings_${PREMIER_LEAGUE_SEASON}`,
    `/competitions/PL/standings?season=${PREMIER_LEAGUE_SEASON}`
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

  // Never fall back to a previous-season table.
  const hasCoventry = rows.some(row => /coventry city/i.test(row.team));
  return hasCoventry ? rows : [];
}

async function buildDashboardData() {
  const city = await findCoventryTeam();

  const [upcomingResult, cityForm, standings, matchdayMatches] = await Promise.all([
    getUpcomingMatches(city.id),
    getLastFive(city.id),
    getStandings(),
    getMatchdayWindow(city.id)
  ]);

  const futureFixtures = upcomingResult.matches;

  const next = futureFixtures[0];

  if (!next) {
    throw new Error(
      "No future Coventry City fixture was returned by football-data.org."
    );
  }

  const nextMatch = await enrichNextMatch(next);

  const naturalMatchState = determineMatchState(matchdayMatches, nextMatch);
  const matchState = applyTestMode(naturalMatchState, nextMatch);

  // For genuine live/full-time states, enrich the actual featured match too.
  // In test mode, preserve the simulated score/minute instead.
  let featuredMatch = matchState.featuredMatch;
  if (
    !matchState.testMode &&
    featuredMatch?.id &&
    featuredMatch.id !== nextMatch.id
  ) {
    featuredMatch = await enrichNextMatch(featuredMatch);
  }

  const featuredOpponent =
    featuredMatch?.opponent?.id
      ? featuredMatch.opponent
      : nextMatch.opponent;

  const opponentForm = await getLastFive(featuredOpponent.id);

  const warnings = [
    ...cityForm.warnings,
    ...opponentForm.warnings
  ];

  if (cityForm.matches.length < 5) {
    warnings.push(
      `Coventry form returned ${cityForm.matches.length}/5 matches`
    );
  }

  if (opponentForm.matches.length < 5) {
    warnings.push(
      `${featuredOpponent.name} form returned ` +
      `${opponentForm.matches.length}/5 matches`
    );
  }

  return {
    generatedAt: new Date().toISOString(),
    season: PREMIER_LEAGUE_SEASON,
    diagnostics: {
      upcomingFixtures: upcomingResult.diagnostics,
      matchday: {
        mode: matchState.mode,
        testModeActive: matchState.testMode === true,
        refreshAfterSeconds: matchState.refreshAfterSeconds,
        featuredMatchId: featuredMatch?.id || null,
        featuredMatchStatus: featuredMatch?.status || null
      },
      cityLast5: cityForm.diagnostics,
      opponentLast5: opponentForm.diagnostics
    },
    city: {
      id: city.id,
      name: city.shortName || city.name,
      crest: city.crest || ""
    },
    nextMatch,
    featuredMatch,
    matchState: matchState.mode,
    testModeActive: matchState.testMode === true,
    refreshAfterSeconds: matchState.refreshAfterSeconds,
    // Excludes the featured Next Match. These are fixtures 2, 3 and 4.
    nextThree: futureFixtures.slice(1, 4),
    cityLast5: cityForm.matches,
    opponentLast5: opponentForm.matches,
    standings,
    warnings
  };
}

async function handleApi(req, res) {
  if (req.url === "/api/status") {
    const config = loadConfig();
    return json(res, 200, {
      configured: !!(
        config &&
        config.footballDataApiKey &&
        !config.footballDataApiKey.includes("PASTE-")
      ),
      version: "2.3"
    });
  }

  if (req.url === "/api/diagnostics") {
    const cacheKey = `dashboard_${PREMIER_LEAGUE_SEASON}_${DASHBOARD_CACHE_VERSION}`;
    const cached = readStaleCache(cacheKey);

    return json(res, 200, {
      version: "2.4e",
      diagnostics: cached?.diagnostics || null,
      warnings: cached?.warnings || [],
      generatedAt: cached?.generatedAt || null
    });
  }

  if (req.url === "/api/dashboard") {
    const cacheKey =
      `dashboard_${PREMIER_LEAGUE_SEASON}_${DASHBOARD_CACHE_VERSION}`;

    const freshRecord = readCacheRecord(cacheKey);

    if (freshRecord) {
      const adaptiveTtlMs =
        Math.max(
          60,
          freshRecord.data?.refreshAfterSeconds || 3600
        ) * 1000;

      if (Date.now() - freshRecord.savedAt <= adaptiveTtlMs) {
        return json(res, 200, {
          source: "cache",
          cacheAgeSeconds: Math.floor(
            (Date.now() - freshRecord.savedAt) / 1000
          ),
          ...freshRecord.data
        });
      }
    }

    try {
      const data = await buildDashboardData();

      console.log("[2.3d] Dashboard diagnostics:");
      console.log(JSON.stringify(data.diagnostics, null, 2));

      console.log("[2.3d] Next 3 selected:");
      console.log(
        JSON.stringify(
          (data.nextThree || []).map(m => ({
            utcDate: m.utcDate,
            homeTeam: m.homeTeam?.name,
            awayTeam: m.awayTeam?.name,
            status: m.status
          })),
          null,
          2
        )
      );

      writeCache(cacheKey, data);

      return json(res, 200, {
        source: "live",
        cacheAgeSeconds: 0,
        ...data
      });
    } catch (err) {
      const stale = readStaleCache(cacheKey);

      if (stale) {
        return json(res, 200, {
          source: "stale-cache",
          warning: err.message,
          warnings: [
            ...(stale.warnings || []),
            `live refresh failed: ${err.message}`
          ],
          ...stale
        });
      }

      return json(res, 500, { error: err.message });
    }
  }

  json(res, 404, { error: "Not found" });
}

const MIME = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".svg": "image/svg+xml",
  ".webp": "image/webp"
};

function serveStatic(req, res) {
  let requestPath = req.url.split("?")[0];
  if (requestPath === "/") requestPath = "/index.html";

  const filePath = path.normalize(path.join(ROOT, requestPath));

  if (!filePath.startsWith(ROOT)) {
    return text(res, 403, "Forbidden");
  }

  fs.readFile(filePath, (err, data) => {
    if (err) return text(res, 404, "Not found");

    const ext = path.extname(filePath).toLowerCase();

    res.writeHead(200, {
      "Content-Type": MIME[ext] || "application/octet-stream",
      "Cache-Control": "no-cache"
    });
    res.end(data);
  });
}

const server = http.createServer(async (req, res) => {
  try {
    if (req.url.startsWith("/api/")) {
      await handleApi(req, res);
    } else {
      serveStatic(req, res);
    }
  } catch (err) {
    json(res, 500, { error: err.message });
  }
});

server.listen(PORT, "127.0.0.1", () => {
  console.log("");
  console.log("Sky Blues Screensaver Stage 2.4e");
  console.log(`Open: http://localhost:${PORT}`);
  console.log("");
  console.log("Press Ctrl+C to stop.");
});
