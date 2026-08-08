export default function handler(req, res) {
  return res.status(200).json({
    service: "matchday-desktop-api",
    version: "2.6d",
    status: "ok",
    timestamp: new Date().toISOString()
  });
}
