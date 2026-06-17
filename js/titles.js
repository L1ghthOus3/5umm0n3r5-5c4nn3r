// Challenge metadata from CommunityDragon's challenges.json. It holds a
// `titles` map (UUID -> { name, itemId, ... }) and a `challenges` map keyed by
// challengeId (-> { name, description, ... }). We build two lookups: itemId ->
// title name (for preferences.title) and challengeId -> { name, description }
// (for the pinned-challenge tooltips).

const TITLES_URL =
  "https://raw.communitydragon.org/latest/plugins/rcp-be-lol-game-data" +
  "/global/default/v1/challenges.json";

const titleById = {};     // itemId (number) -> "Apprentice"
const challengeById = {}; // challengeId (string) -> { name, description }

export async function loadTitles() {
  try {
    const res = await fetch(TITLES_URL);
    const json = await res.json();
    for (const t of Object.values(json.titles || {})) {
      if (t && t.itemId != null) titleById[t.itemId] = t.name;
    }
    for (const [id, c] of Object.entries(json.challenges || {})) {
      if (c) challengeById[id] = { name: c.name, description: c.description };
    }
  } catch (e) {
    console.error("Failed to load challenge data", e);
  }
}

// Resolve a title name by its itemId (the preferences.title field, which Riot
// returns as a string). Returns null when unknown or not yet loaded.
export function titleNameById(titleId) {
  if (titleId == null || titleId === "") return null;
  return titleById[Number(titleId)] || null;
}

// Resolve a challenge's { name, description } by its challengeId. Returns null
// when unknown or not yet loaded.
export function challengeInfoById(challengeId) {
  if (challengeId == null) return null;
  return challengeById[String(challengeId)] || null;
}
