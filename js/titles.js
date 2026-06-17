// Challenge title data from CommunityDragon. The big challenges.json holds a
// `titles` map (UUID -> { name, itemId, ... }); a player's preferences.title
// (from lol-challenges-v1) is the title's numeric itemId as a string. We build
// an itemId -> name lookup so that id can be resolved to a display name.

const TITLES_URL =
  "https://raw.communitydragon.org/latest/plugins/rcp-be-lol-game-data" +
  "/global/default/v1/challenges.json";

const titleById = {}; // itemId (number) -> "Apprentice"

export async function loadTitles() {
  try {
    const res = await fetch(TITLES_URL);
    const json = await res.json();
    for (const t of Object.values(json.titles || {})) {
      if (t && t.itemId != null) titleById[t.itemId] = t.name;
    }
  } catch (e) {
    console.error("Failed to load challenge titles", e);
  }
}

// Resolve a title name by its itemId (the preferences.title field, which Riot
// returns as a string). Returns null when unknown or not yet loaded.
export function titleNameById(titleId) {
  if (titleId == null || titleId === "") return null;
  return titleById[Number(titleId)] || null;
}
