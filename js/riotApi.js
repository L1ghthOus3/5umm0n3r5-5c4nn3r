// Riot API calls: account lookup, match history, and ranked league entries.

import { RIOT_API_KEY, REGIONAL_CLUSTER } from "./config.js";

const key = () => `api_key=${encodeURIComponent(RIOT_API_KEY)}`;
const clusterHost = (region) => REGIONAL_CLUSTER[region] || "europe";
const platformHost = (region) => region.toLowerCase();

async function getJson(url, label) {
  const res = await fetch(url);
  if (!res.ok) {
    if (res.status === 404) throw new Error(`${label}: not found.`);
    if (res.status === 401 || res.status === 403)
      throw new Error("API key rejected or expired.");
    if (res.status === 429) throw new Error("Rate limited — try again shortly.");
    throw new Error(`${label} failed (${res.status}).`);
  }
  return res.json();
}

// Account-V1 (regional cluster). Returns { puuid, gameName, tagLine }.
export function fetchAccount(gameName, tagLine, region) {
  const url =
    `https://${clusterHost(region)}.api.riotgames.com/riot/account/v1/accounts/by-riot-id` +
    `/${encodeURIComponent(gameName)}/${encodeURIComponent(tagLine)}?${key()}`;
  return getJson(url, "Account").catch((e) => {
    // Friendlier message for the common case.
    if (/not found/.test(e.message)) throw new Error("No Riot account with that name#tag.");
    throw e;
  });
}

// Match-V5 (regional cluster). Returns an array of match-id strings.
export function fetchMatchIds(puuid, region, start = 0, count = 100) {
  const url =
    `https://${clusterHost(region)}.api.riotgames.com/lol/match/v5/matches/by-puuid` +
    `/${encodeURIComponent(puuid)}/ids?start=${start}&count=${count}&${key()}`;
  return getJson(url, "Match list");
}

// Match-V5 single match detail (regional cluster).
export function fetchMatch(matchId, region) {
  const url =
    `https://${clusterHost(region)}.api.riotgames.com/lol/match/v5/matches` +
    `/${encodeURIComponent(matchId)}?${key()}`;
  return getJson(url, "Match");
}

// League-V4 ranked entries (platform host, e.g. euw1). Best-effort: never throws.
export async function fetchRankedEntry(puuid, region) {
  try {
    const url =
      `https://${platformHost(region)}.api.riotgames.com/lol/league/v4/entries/by-puuid` +
      `/${encodeURIComponent(puuid)}?${key()}`;
    const entries = await getJson(url, "Ranked");
    return entries.find((e) => e.queueType === "RANKED_SOLO_5x5")
      || entries.find((e) => e.queueType === "RANKED_FLEX_SR")
      || null;
  } catch (e) {
    console.warn("Ranked lookup failed", e);
    return null;
  }
}
