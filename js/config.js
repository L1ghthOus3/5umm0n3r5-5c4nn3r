// Shared constants and configuration.

// No length limit. The name may contain spaces but must end with a tag:
// some content, then "#", then at least one character (e.g. "name#12E").
export const NAME_PATTERN = /^.+#.+$/;

// Base URL of the backend proxy (the NestJS API that holds RIOT_API_KEY
// server-side — see README.md). The Riot key never reaches the browser now.
//
// Pick the API origin from where the site is running: localhost when developing
// locally, the deployed Vercel API in production.
const isDev = true;
export const API_BASE = isDev
  ? "http://localhost:3000"
  : "https://r10t-4p1-wr4pp3r.vercel.app";
