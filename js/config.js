// Shared constants and configuration.

// No length limit. The name may contain spaces but must end with a tag:
// some content, then "#", then at least one character (e.g. "name#12E").
export const NAME_PATTERN = /^.+#.+$/;

// Rank/tier color codes, keyed by the uppercase level names used in the Riot
// DTOs (challenge `level`, league `tier`).
export const RANK_COLOR = Object.freeze({
  IRON: "#5A4638",
  BRONZE: "#8C5030",
  SILVER: "#8090A0",
  GOLD: "#C89B3C",
  PLATINUM: "#4E9996",
  DIAMOND: "#6C5CE7",
  MASTER: "#A347D1",
  GRANDMASTER: "#d66d7c",
  CHALLENGER: "#4BB7FF",
});

// Look up a rank color by level/tier name (case-insensitive); null for
// NONE/unknown so callers can fall back to a default.
export function rankColor(level) {
  if (!level) return null;
  return RANK_COLOR[String(level).toUpperCase()] || null;
}

// Base URL of the backend proxy (the NestJS API that holds RIOT_API_KEY
// server-side — see README.md). The Riot key never reaches the browser now.
//
// Pick the API origin from where the site is running: localhost when developing
// locally, the deployed Vercel API in production.
const isDev = false;
// export const API_BASE = "http://localhost:3000";
export const API_BASE = "https://r10t-4p1-wr4pp3r.vercel.app";
