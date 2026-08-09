export default function handler(req, res) {
  return res.status(200).json({
    service: "matchday-desktop-api",
    version: "3.1b",
    message: "Coventry City dashboard is available through the generic club route.",
    preferredEndpoint: "/api/v1/clubs/coventry-city/dashboard",
    compatibilityEndpoint: "/api/v1/clubs/coventry-city-dashboard"
  });
}
