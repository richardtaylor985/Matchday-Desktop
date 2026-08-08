import genericHandler from "./[club]/dashboard.js";

export default async function handler(req, res) {
  req.query = {
    ...(req.query || {}),
    club: "coventry-city"
  };

  return genericHandler(req, res);
}
