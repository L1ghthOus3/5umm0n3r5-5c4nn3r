// Shared constants and configuration.

// No length limit. The name may contain spaces but must end with a tag:
// some content, then "#", then at least one character (e.g. "name#12E").
export const NAME_PATTERN = /^.+#.+$/;

// NOTE: this key is exposed in client-side code and Riot's API does not send
// CORS headers, so a browser fetch will normally be blocked. In production this
// call must go through your own backend proxy.
//
// The value is read at runtime from the project's .env (key: RIOT_API_KEY) by
// loadConfig() below. It's a live binding, so importers see the value once the
// fetch resolves — call loadConfig() before making any API request.
export let RIOT_API_KEY = "";

// Fetch and parse .env, populating RIOT_API_KEY. Tolerates the usual quirks:
// spaces around "=", single/double quotes, a trailing semicolon, and comments.
export async function loadConfig() {
  try {
    const text = await (await fetch(".env")).text();
    for (const line of text.split(/\r?\n/)) {
      const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.+?)\s*$/i);
      if (!m || m[1] !== "RIOT_API_KEY") continue;
      RIOT_API_KEY = m[2].replace(/;$/, "").trim().replace(/^["']|["']$/g, "");
      return;
    }
    console.error(".env loaded but RIOT_API_KEY not found");
  } catch (e) {
    console.error("Failed to load .env", e);
  }
}

// Account-V1 and Match-V5 route through regional clusters (americas/asia/europe),
// not platform IDs. Map the selected platform to its cluster.
export const REGIONAL_CLUSTER = {
  BR1: "americas", LA1: "americas", LA2: "americas", NA1: "americas", OC1: "americas",
  JP1: "asia", KR: "asia", SG2: "asia",
  EUN1: "europe", EUW1: "europe", ME1: "europe", RU: "europe", TR1: "europe",
};
