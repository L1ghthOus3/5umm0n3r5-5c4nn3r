// Shared constants and configuration.

// No length limit. The name may contain spaces but must end with a tag:
// some content, then "#", then at least one character (e.g. "name#12E").
export const NAME_PATTERN = /^.+#.+$/;

// Base URL of the backend proxy (the NestJS API that holds RIOT_API_KEY
// server-side — see README.md). The Riot key never reaches the browser now.
//
// Dev: NestJS defaults to http://localhost:3000.
// Prod: set this to your deployed API origin, e.g. "https://api.example.com".
// Leave it "" to call a same-origin API (when the API is served under /).
export const API_BASE = "http://localhost:3000";
