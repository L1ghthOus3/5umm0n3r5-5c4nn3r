// Entry point: boot the background, load champion data, wire up the console.

import { startStarField } from "./starfield.js";
import { loadChampions } from "./champions.js";
import { loadQueues } from "./queues.js";
import { initConsole } from "./login.js";

function init() {
  const canvas = document.getElementById("stars");
  if (canvas) startStarField(canvas);
  loadChampions(); // fire-and-forget; map is ready before any lookup completes
  loadQueues();    // ditto: queueId -> game type lookup for the match history
  initConsole();   // API key now lives server-side, so no config to load first
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", init);
} else {
  init();
}
