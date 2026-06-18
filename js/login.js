// Login window controller: validation, request flow, and the login/profile swap.

import { NAME_PATTERN } from "./config.js";
import { fetchAccount } from "./riotApi.js";
import { initStatsView } from "./statsView.js";
import { loadSavedSummoner, clearSummoner } from "./session.js";

export function initConsole() {
  const form = document.getElementById("loginForm");
  const profileView = document.getElementById("profileView");
  const backBtn = document.getElementById("backBtn");
  const input = document.getElementById("su");
  const region = document.getElementById("region");
  const fieldWrap = document.getElementById("fieldWrap");
  const feedback = document.getElementById("feedback");
  const feedbackText = document.getElementById("feedbackText");
  const blip = document.getElementById("blip");
  const submitBtn = document.getElementById("submitBtn");
  const submitLabel = document.getElementById("submitLabel");
  const loadbar = document.getElementById("loadbar");

  const statsView = initStatsView();

  let error = "";
  let status = "idle"; // idle | loading | done
  let account = null;
  let loadTimer = null;

  const trimmedName = () => input.value.trim();

  function validate() {
    const trimmed = trimmedName();
    if (trimmed.length === 0) return "Enter a summoner name to continue.";
    if (!NAME_PATTERN.test(trimmed))
      return "Name must end with a tag, e.g. name#12E.";
    return "";
  }

  function render() {
    // swap windows: login console vs. profile dashboard
    const showProfile = status === "done";
    form.hidden = showProfile;
    profileView.hidden = !showProfile;

    fieldWrap.classList.toggle("error", !!error);

    // feedback line
    feedback.classList.remove("err", "ok");
    let text = "Must end with a tag, e.g. name#12E — anything after #.";
    let showBlip = false;
    if (error) {
      feedback.classList.add("err");
      text = error;
      showBlip = true;
    } else if (status === "loading") {
      text = "Connecting to the rift…";
    }
    feedbackText.textContent = text;
    blip.hidden = !showBlip;

    // submit button
    input.disabled = status === "loading";
    submitBtn.disabled = status === "loading";
    submitLabel.textContent = status === "loading" ? "LOADING…" : "ENTER";
    loadbar.hidden = status !== "loading";
  }

  function triggerShake() {
    // Restart the CSS shake animation by reflowing the element.
    fieldWrap.classList.remove("error");
    void fieldWrap.offsetWidth;
    fieldWrap.classList.add("error");
  }

  // Creep the load bar toward ~90% while the request is in flight.
  function startLoadbar() {
    let p = 0;
    loadbar.style.width = "0%";
    loadTimer = setInterval(() => {
      p += Math.random() * 10 + 4;
      if (p > 90) p = 90;
      loadbar.style.width = p + "%";
    }, 160);
  }
  function finishLoadbar() {
    if (loadTimer) { clearInterval(loadTimer); loadTimer = null; }
    loadbar.style.width = "100%";
  }

  async function submitName(trimmed) {
    const hash = trimmed.lastIndexOf("#");
    const gameName = trimmed.slice(0, hash).trim();
    const tagLine = trimmed.slice(hash + 1).trim();

    status = "loading";
    account = null;
    render();
    startLoadbar();

    try {
      account = await fetchAccount(gameName, tagLine, region.value);
      // 200 on the account — load the stats dashboard before revealing it.
      await statsView.load(account, region.value);
      finishLoadbar();
      status = "done";
      render();
    } catch (err) {
      finishLoadbar();
      status = "idle";
      error = err.message || "Lookup failed.";
      render();
      triggerShake();
      input.focus();
    }
  }

  // No limit or sanitizing — just clear any prior error as the user types.
  input.addEventListener("input", () => {
    if (error) error = "";
    render();
  });

  input.addEventListener("focus", () => fieldWrap.classList.add("focused"));
  input.addEventListener("blur", () => fieldWrap.classList.remove("focused"));
  fieldWrap.addEventListener("click", () => input.focus());

  form.addEventListener("submit", (e) => {
    e.preventDefault();
    if (status === "loading") return;

    const err = validate();
    if (err) {
      error = err;
      render();
      triggerShake();
      input.focus();
      return;
    }

    error = "";
    submitName(trimmedName());
  });

  // Sign out — return to the login window and forget the saved session.
  backBtn.addEventListener("click", () => {
    clearSummoner();
    status = "idle";
    account = null;
    error = "";
    input.value = "";
    render();
    input.focus();
  });

  // Restore a previous session: prefill the form and sign back in automatically.
  const saved = loadSavedSummoner();
  if (saved) {
    input.value = saved.name;
    region.value = saved.region;
    submitName(saved.name);
  } else {
    input.focus();
  }

  render();
}
