export default function handler(req, res) {
  return res.status(200).json({
    service: "matchday-desktop-api",
    version: "3.0b",
    status: "ok",
    timestamp: new Date().toISOString()
  });
}
