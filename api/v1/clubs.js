import { CLUBS } from "./_lib/clubs.js";

export default function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  res.setHeader("Cache-Control", "s-maxage=3600, stale-while-revalidate=86400");

  if (req.method === "OPTIONS") {
    return res.status(204).end();
  }

  if (req.method !== "GET") {
    return res.status(405).json({
      service: "matchday-desktop-api",
      version: "3.0b",
      error: "Method not allowed"
    });
  }

  const clubs = Object.values(CLUBS).map(club => ({
    slug: club.slug,
    displayName: club.displayName,
    shortName: club.shortName,
    tla: club.tla,
    competitionCode: club.competitionCode,
    seasonStartYear: club.seasonStartYear,
    themeKey: club.themeKey
  }));

  return res.status(200).json({
    service: "matchday-desktop-api",
    version: "3.0b",
    contract: "clubs-v1",
    clubs
  });
}
