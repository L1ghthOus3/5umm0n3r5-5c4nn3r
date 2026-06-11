// Frontend client for the summoner-stats backend (the NestJS proxy that holds
// the Riot API key server-side). These call your own API, not Riot directly —
// the routes mirror the ones documented in README.md. Every route takes the
// platform `region` as a query param; the backend resolves regional clusters.

import { API_BASE } from "./config.js";

// Pull a human-readable message out of a Nest error body
// ({ statusCode, message, error }); `message` may be a validation string[].
function errorMessage(body) {
  if (!body || body.message == null) return "";
  return Array.isArray(body.message) ? body.message.join(", ") : body.message;
}

async function getJson(url, label) {
  let res;
  try {
    res = await fetch(url);
  } catch {
    throw new Error("Can't reach the server — is the API running?");
  }

  // Some routes (ranked) answer 200 with an empty body to mean "nothing".
  if (res.status === 204) return null;

  let body = null;
  try {
    body = await res.json();
  } catch {
    body = null; // empty/non-JSON body
  }

  if (!res.ok) {
    const msg = errorMessage(body);
    // 400 = bad query param (validation); 500 = upstream Riot error whose
    // message says which: not found, key rejected/expired, or rate limited.
    if (res.status === 400) throw new Error(msg || `${label}: invalid request.`);
    if (/rate limit/i.test(msg)) throw new Error("Rate limited — try again shortly.");
    throw new Error(msg || `${label} failed (${res.status}).`);
  }
  return body;
}

// GET /account-v1/accounts/by-riot-id/:username/:tagLine?region=
// Returns { puuid, gameName, tagLine }.
export function fetchAccount(gameName, tagLine, region) {
  const url =
    `${API_BASE}/account-v1/accounts/by-riot-id` +
    `/${encodeURIComponent(gameName)}/${encodeURIComponent(tagLine)}` +
    `?region=${encodeURIComponent(region)}`;
  return getJson(url, "Account").catch((e) => {
    // Friendlier message for the common case (backend folds 404 into a 500).
    if (/not found/i.test(e.message)) throw new Error("No Riot account with that name#tag.");
    throw e;
  });
}

// GET /match-v5/matches/by-puuid/:puuid?region=&start=&count=
// Returns an array of match-id strings (newest first).
export function fetchMatchIds(puuid, region, start = 0, count = 100) {
  const url =
    `${API_BASE}/match-v5/matches/by-puuid/${encodeURIComponent(puuid)}` +
    `?region=${encodeURIComponent(region)}&start=${start}&count=${count}`;
  return getJson(url, "Match list");
}

// GET /match-v5/matches/:id?region=
// Returns a full MatchDto.
export function fetchMatch(matchId, region) {
  const url =
    `${API_BASE}/match-v5/matches/${encodeURIComponent(matchId)}` +
    `?region=${encodeURIComponent(region)}`;
  return getJson(url, "Match");
}

// GET /league-v4/entries/by-puuid/:puuid?region=
// Best-effort: the backend already picks solo → flex → null and swallows
// errors, so this returns the entry or null and never throws.
export async function fetchRankedEntry(puuid, region) {
  try {
    const url =
      `${API_BASE}/league-v4/entries/by-puuid/${encodeURIComponent(puuid)}` +
      `?region=${encodeURIComponent(region)}`;
    return await getJson(url, "Ranked");
  } catch (e) {
    console.warn("Ranked lookup failed", e);
    return null;
  }
}
