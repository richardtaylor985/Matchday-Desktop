export default function handler(req, res) {
  return res.status(200).json({
    service: "matchday-desktop-api",
    version: "2.5c",
    message: "Stage 2.5b dashboard endpoint is available.",
    dashboardEndpoint: "/api/v1/clubs/coventry-city-dashboard"
  });
}
