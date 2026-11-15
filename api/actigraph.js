// Vercel serverless function: ActiGraph CentrePoint, through the server so the client secret
// stays out of the browser. Rules and checks: lib/actigraph-handler.js.

import { handleActigraph } from "../lib/actigraph-handler.js";

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  const out = await handleActigraph({ method: req.method, query: req.query, headers: req.headers }, process.env);
  res.status(out.status).json(out.body);
}
