// Entry point: boot the background, load champion data, wire up the console.

import { startStarField } from "./starfield.js";
import { loadConfig } from "./config.js";
import { loadChampions } from "./champions.js";
import { loadQueues } from "./queues.js";
import { initConsole } from "./login.js";

async function init() {
  const canvas = document.getElementById("stars");
  if (canvas) startStarField(canvas);
  loadChampions(); // fire-and-forget; map is ready before any lookup completes
  loadQueues();    // ditto: queueId -> game type lookup for the match history
  await loadConfig(); // RIOT_API_KEY must be populated before any API call
  initConsole();
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", init);
} else {
  init();
}
