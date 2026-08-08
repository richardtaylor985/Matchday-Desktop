const API_BASE = "https://api.football-data.org/v4";
const SEASON = 2026;
const COVENTRY_PROVIDER_ID = 1076;

async function footballApi(path) {
  const token = process.env.FOOTBALL_DATA_API_KEY;

  if (!token) {
    throw new Error("FOOTBALL_DATA_API_KEY is not configured");
  }

  const response = await fetch(`${API_BASE}${path}`, {
    headers: {
      "X-Auth-Token": token
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

function normaliseMatch(match) {
  return {
    id: match.id,
    utcDate: match.utcDate,
    status: match.status,
    venue: match.venue || "",
    homeTeam: {
      id: match.homeTeam?.id,
      name: match.homeTeam?.shortName || match.homeTeam?.name || "",
      crest: match.homeTeam?.crest || ""
    },
    awayTeam: {
      id: match.awayTeam?.id,
      name: match.awayTeam?.shortName || match.awayTeam?.name || "",
      crest: match.awayTeam?.crest || ""
    },
    score: match.score || null
  };
}

export default async function handler(req, res) {
  try {
    const now = new Date();
    const dateFrom = now.toISOString().slice(0, 10);
    const dateTo = `${SEASON + 1}-06-30`;

    const [matchesData, standingsData] = await Promise.all([
      footballApi(
        `/teams/${COVENTRY_PROVIDER_ID}/matches` +
        `?dateFrom=${dateFrom}&dateTo=${dateTo}&limit=100`
      ),
      footballApi(`/competitions/PL/standings?season=${SEASON}`)
    ]);

    const upcoming = (matchesData.matches || [])
      .map(normaliseMatch)
      .filter(match => new Date(match.utcDate) >= now)
      .sort((a, b) => new Date(a.utcDate) - new Date(b.utcDate));

    const total =
      (standingsData.standings || []).find(s => s.type === "TOTAL") ||
      standingsData.standings?.[0];

    const standings = (total?.table || []).map(row => ({
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

    res.setHeader(
      "Cache-Control",
      "s-maxage=900, stale-while-revalidate=3600"
    );

    return res.status(200).json({
      service: "matchday-desktop-api",
      version: "2.5a",
      club: "coventry-city",
      generatedAt: new Date().toISOString(),
      nextMatch: upcoming[0] || null,
      nextThree: upcoming.slice(1, 4),
      standings
    });
  } catch (error) {
    return res.status(500).json({
      error: error.message
    });
  }
}
