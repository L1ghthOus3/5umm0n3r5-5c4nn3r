// Persist the currently viewed summoner so the session survives a reload.
// Stored as { name: "gameName#tagLine", region } under a single key. The value
// lives only in the visitor's browser — see privacy.html.

const STORAGE_KEY = "summoner";

export function loadSavedSummoner() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const saved = JSON.parse(raw);
    if (saved && typeof saved.name === "string" && typeof saved.region === "string") {
      return saved;
    }
  } catch {
    // malformed/unavailable storage — fall through to a fresh login
  }
  return null;
}

export function saveSummoner(name, region) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ name, region }));
  } catch {
    // storage may be disabled (private mode); persistence is best-effort
  }
}

export function clearSummoner() {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    // ignore
  }
}
