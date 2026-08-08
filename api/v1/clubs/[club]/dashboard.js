import { getClubConfig } from "../../_lib/clubs.js";
import { buildDashboard } from "../../_lib/dashboard.js";

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
      version: "2.6d",
      error: "Method not allowed"
    });
  }

  const slug = String(req.query?.club || "").toLowerCase();
  const club = getClubConfig(slug);

  if (!club) {
    return res.status(404).json({
      service: "matchday-desktop-api",
      version: "2.6d",
      contract: "dashboard-v1",
      error: "Club not found",
      requestedClub: slug || null
    });
  }

  try {
    const data = await buildDashboard(req, club);

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
      version: "2.6d",
      contract: "dashboard-v1",
      club: club.slug,
      error: error.message
    });
  }
}
