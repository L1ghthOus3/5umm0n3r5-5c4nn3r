// Queue metadata loaded from the local queues.json. Maps a match's numeric
// queueId to a human-readable game type (Riot's queue descriptions).

const queueById = {}; // 420 -> { description: "5v5 Ranked Solo games", map: "Summoner's Rift" }

export async function loadQueues() {
  try {
    const res = await fetch("queues.json");
    const list = await res.json();
    for (const q of list) {
      queueById[q.queueId] = { description: q.description, map: q.map };
    }
  } catch (e) {
    console.error("Failed to load queues.json", e);
  }
}

// Tidy Riot's descriptions for display: drop the redundant trailing " games".
function tidy(description) {
  return description.replace(/\s+games$/i, "").trim();
}

// Human-readable queue type by numeric queueId (from match data).
export function queueName(queueId) {
  const q = queueById[queueId];
  return q && q.description ? tidy(q.description) : "Normal";
}

// Coarse category used in the match row footer.
export function queueCategory(queueId) {
  const q = queueById[queueId];
  return q && /ranked/i.test(q.description) ? "Ranked" : "Normal";
}
