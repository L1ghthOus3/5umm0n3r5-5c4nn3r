// Stats dashboard controller: summoner card, match history, and pagination.

import {
  fetchMatchIds, fetchMatch, fetchRankedEntry, fetchChallenges,
} from "./riotApi.js";
import {
  profileIconUrl, championIconById, championNameById, itemIconUrl,
} from "./champions.js";
import { queueName, queueCategory } from "./queues.js";
import { rankColor } from "./config.js";

const PER_PAGE = 10;
const ID_LIMIT = 100; // Match-V5 caps /ids at 100 per request.

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}

function timeAgo(ms) {
  const s = Math.floor((Date.now() - ms) / 1000);
  if (s < 3600) return `${Math.max(1, Math.floor(s / 60))}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
}

// Arena (CHERRY) matches replace the usual two 100/200 teams with eight
// two-player subteams ranked by placement. This helper detects them.
function isArenaMatch(info) {
  return info.gameMode === "CHERRY";
}

// Group Arena participants into subteams, sorted by final placement.
// Returns [{ subteamId, placement, players: [participant, ...] }, ...].
function groupArenaTeams(info) {
  const teams = new Map();
  for (const p of info.participants) {
    const subteamId = p.playerSubteamId;
    if (!teams.has(subteamId)) {
      teams.set(subteamId, {
        subteamId,
        placement: p.subteamPlacement ?? p.placement,
        players: [],
      });
    }
    teams.get(subteamId).players.push(p);
  }
  return [...teams.values()].sort((a, b) => a.placement - b.placement);
}

// Extract this player's row from a raw match into a flat view model.
function parseMatch(match, puuid) {
  const info = match.info;
  const p = info.participants.find((x) => x.puuid === puuid);
  if (!p) return null;
  const cs = (p.totalMinionsKilled || 0) + (p.neutralMinionsKilled || 0);
  const durMin = info.gameDuration / 60;
  const kda = (p.kills + p.assists) / Math.max(1, p.deaths);
  const arena = isArenaMatch(info);
  // In Arena the top 4 of 8 subteams "win"; placement is the real result.
  const placement = arena ? (p.subteamPlacement ?? p.placement) : null;
  return {
    championId: p.championId,
    championName: p.championName,
    win: arena ? placement <= 4 : p.win,
    arena,
    placement,
    kills: p.kills, deaths: p.deaths, assists: p.assists,
    kda,
    cs,
    csPerMin: durMin ? cs / durMin : 0,
    durationMin: Math.round(durMin),
    queueId: info.queueId,
    endTs: info.gameEndTimestamp || (info.gameStartTimestamp + info.gameDuration * 1000),
    profileIcon: p.profileIcon,
    summonerLevel: p.summonerLevel,
  };
}

// Ordinal suffix for an Arena placement (1 -> "1st", 2 -> "2nd", ...).
function ordinal(n) {
  const s = ["th", "st", "nd", "rd"];
  const v = n % 100;
  return n + (s[(v - 20) % 10] || s[v] || s[0]);
}

export function initStatsView() {
  const el = {
    icon: document.getElementById("scIcon"),
    level: document.getElementById("scLevel"),
    name: document.getElementById("scName"),
    tag: document.getElementById("scTag"),
    region: document.getElementById("scRegion"),
    challenge: document.getElementById("scChallenge"),
    rank: document.getElementById("scRank"),
    rankText: document.getElementById("scRankText"),
    lp: document.getElementById("scLp"),
    ring: document.getElementById("wrRing"),
    pct: document.getElementById("wrPct"),
    record: document.getElementById("wrRecord"),
    head: document.getElementById("mhHead"),
    meta: document.getElementById("mhMeta"),
    list: document.getElementById("matchList"),
    pager: document.getElementById("pager"),
    detail: document.getElementById("matchDetail"),
  };

  const state = {
    account: null,
    region: "EUW1",
    ids: [],
    cache: new Map(), // matchId -> parsed (or null if it failed)
    raw: new Map(),   // matchId -> full MatchDto (for the detail scoreboard)
    page: 0,
    ranked: null,
    challengeLevel: null, // totalPoints.level from lol-challenges-v1 (or null)
    seen: { wins: 0, total: 0 }, // win rate fallback from loaded matches
  };

  // ---- card ----
  function setWinRate(pct, wins, losses) {
    el.pct.textContent = `${pct}%`;
    el.ring.style.background =
      `conic-gradient(var(--cyan) ${pct}%, rgba(43,214,255,0.12) ${pct}%)`;
    el.record.innerHTML = `<b class="w">${wins}W</b> <b class="l">${losses}L</b>`;
  }

  function renderCard(firstMatch) {
    el.name.textContent = state.account.gameName;
    el.tag.textContent = `#${state.account.tagLine}`;
    el.region.textContent = state.region;

    // Challenge total-points level next to the region (best-effort; hidden if
    // unavailable or NONE).
    const lvl = state.challengeLevel;
    if (lvl && lvl !== "NONE") {
      el.challenge.textContent = lvl;
      el.challenge.style.color = rankColor(lvl) || "";
      el.challenge.style.borderColor = rankColor(lvl) || "";
      el.challenge.hidden = false;
    } else {
      el.challenge.hidden = true;
    }

    if (firstMatch) {
      el.level.textContent = `LV ${firstMatch.summonerLevel}`;
      const url = profileIconUrl(firstMatch.profileIcon);
      el.icon.src = url;
      el.icon.style.visibility = "visible";
    } else {
      el.level.textContent = "LV ?";
      el.icon.removeAttribute("src");
    }

    console.log("puuid", state.account.puuid);
    if (state.ranked) {
      const r = state.ranked;
      el.rankText.textContent = `${r.tier} ${r.rank}`;
      el.rank.classList.remove("unranked");
      el.lp.textContent = `${r.leaguePoints} LP`;
      const total = r.wins + r.losses;
      setWinRate(total ? Math.round((r.wins / total) * 100) : 0, r.wins, r.losses);
    } else {
      el.rankText.textContent = "UNRANKED";
      el.lp.textContent = "";
      const { wins, total } = state.seen;
      setWinRate(total ? Math.round((wins / total) * 100) : 0, wins, total - wins);
    }
  }

  // ---- match rows ----
  function matchRow(m) {
    const row = document.createElement("div");
    row.className = `match ${m.win ? "win" : "loss"}`;
    row.addEventListener("click", () => showMatchDetail(m.matchId));

    // champion icon (with 2-letter fallback)
    const champ = document.createElement("div");
    champ.className = "match-champ";
    const fb = document.createElement("div");
    fb.className = "fallback";
    fb.textContent = (m.championName || "?").slice(0, 2).toUpperCase();
    champ.appendChild(fb);
    const iconUrl = championIconById(m.championId);
    if (iconUrl) {
      const img = document.createElement("img");
      img.alt = m.championName;
      img.loading = "lazy";
      img.src = iconUrl;
      img.onerror = () => img.remove();
      champ.appendChild(img);
    }

    // outcome + meta
    const main = document.createElement("div");
    main.className = "match-main";
    const outcome = document.createElement("div");
    outcome.className = "match-outcome";
    outcome.textContent = m.arena ? `${ordinal(m.placement)} PLACE` : (m.win ? "VICTORY" : "DEFEAT");
    const meta = document.createElement("div");
    meta.className = "match-meta";
    const name = championNameById(m.championId);
    meta.innerHTML =
      `${name}<span class="dot">&middot;</span>` +
      `<span class="q">${queueName(m.queueId)}</span><span class="dot">&middot;</span>` +
      `<span class="dur">${m.durationMin} min</span>`;
    main.appendChild(outcome);
    main.appendChild(meta);

    // KDA
    const kda = document.createElement("div");
    kda.className = "match-kda";
    const score = document.createElement("div");
    score.className = "match-score";
    score.innerHTML =
      `${m.kills}<span class="sep">/</span><span class="d">${m.deaths}</span><span class="sep">/</span>${m.assists}`;
    const ratio = document.createElement("div");
    ratio.className = "match-ratio" + (m.kda >= 4 ? " good" : "");
    ratio.textContent = `${m.kda.toFixed(2)} KDA`;
    kda.appendChild(score);
    kda.appendChild(ratio);

    // CS + result
    const cs = document.createElement("div");
    cs.className = "match-cs";
    const csLine = document.createElement("div");
    csLine.className = "cs";
    csLine.textContent = `${m.cs} CS (${m.csPerMin.toFixed(1)}/m)`;
    const res = document.createElement("div");
    res.className = "res";
    res.textContent = `${m.win ? "Win" : "Loss"} · ${queueCategory(m.queueId)}`;
    cs.appendChild(csLine);
    cs.appendChild(res);

    // time ago
    const ago = document.createElement("div");
    ago.className = "match-ago";
    ago.textContent = timeAgo(m.endTs);

    row.appendChild(champ);
    row.appendChild(main);
    row.appendChild(kda);
    row.appendChild(cs);
    row.appendChild(ago);
    return row;
  }

  // ---- match detail (full scoreboard) ----
  // Restore the list view after the detail scoreboard was shown.
  function restoreListView() {
    el.detail.hidden = true;
    el.detail.innerHTML = "";
    el.head.style.display = "";
    el.list.style.display = "";
    el.pager.style.display = "";
  }

  function detailRow(p, meId, maxDmg, teamWin) {
    const isMe = p.puuid === meId;
    const cs = (p.totalMinionsKilled || 0) + (p.neutralMinionsKilled || 0);
    const dmg = p.totalDamageDealtToChampions || 0;
    const pct = Math.round((dmg / maxDmg) * 100);
    const champName = p.championName || "?";
    const fb = escapeHtml(champName.slice(0, 2).toUpperCase());
    const iconUrl = championIconById(p.championId);
    const name = p.riotIdGameName || p.summonerName || championNameById(p.championId);
    const items = [p.item0, p.item1, p.item2, p.item3, p.item4, p.item5, p.item6]
      .map((id) => {
        const u = itemIconUrl(id);
        return u
          ? `<div class="md-item" style="background-image:url('${u}');background-size:cover"></div>`
          : `<div class="md-item"></div>`;
      })
      .join("");
    // Translucent fallback tile sits over the champ icon (same look as the list).
    const champInner =
      `<div class="fallback">${fb}</div>` +
      (iconUrl ? `<img alt="${escapeHtml(champName)}" loading="lazy" src="${iconUrl}">` : "") +
      `<span class="lvl">${p.champLevel || ""}</span>`;
    return (
      `<div class="md-row ${isMe ? "me" : ""} ${teamWin ? "" : "loss-side"}">` +
        `<div class="md-champ">${champInner}</div>` +
        `<div class="md-name">${escapeHtml(name)}</div>` +
        `<div class="md-kda">${p.kills}<span class="sep">/</span>` +
          `<span class="d">${p.deaths}</span><span class="sep">/</span>${p.assists}</div>` +
        `<div class="md-cs">${cs} cs</div>` +
        `<div class="md-dmg"><div class="bar" style="width:${pct}%"></div>` +
          `<div class="num">${dmg.toLocaleString()}</div></div>` +
        `<div class="md-gold">${((p.goldEarned || 0) / 1000).toFixed(1)}k</div>` +
        `<div class="md-items">${items}</div>` +
      `</div>`
    );
  }

  function teamBlock(info, teamId, meId, maxDmg) {
    const team = (info.teams || []).find((t) => t.teamId === teamId);
    const members = info.participants.filter((p) => p.teamId === teamId);
    if (members.length === 0) return "";
    const win = team ? team.win : !!members[0].win;
    const k = members.reduce((s, p) => s + p.kills, 0);
    const d = members.reduce((s, p) => s + p.deaths, 0);
    const a = members.reduce((s, p) => s + p.assists, 0);
    const o = (team && team.objectives) || {};
    const obj = (label, node) => `<span>${label} <b>${(node && node.kills) || 0}</b></span>`;
    return (
      `<div class="md-team ${win ? "win" : "loss"}">` +
        `<div class="md-team-head">` +
          `<span class="md-team-name">${win ? "VICTORY" : "DEFEAT"}</span>` +
          `<span class="md-team-kills">${k} / ${d} / ${a}</span>` +
          `<span class="md-objs">` +
            `${obj("T", o.tower)}${obj("D", o.dragon)}${obj("B", o.baron)}${obj("H", o.riftHerald)}` +
          `</span>` +
        `</div>` +
        members.map((p) => detailRow(p, meId, maxDmg, win)).join("") +
      `</div>`
    );
  }

  // One Arena subteam block: header shows final placement, rows reuse the
  // shared scoreboard row. Top-4 subteams are styled as wins.
  function arenaTeamBlock(team, meId, maxDmg) {
    const win = team.placement <= 4;
    const k = team.players.reduce((s, p) => s + p.kills, 0);
    const d = team.players.reduce((s, p) => s + p.deaths, 0);
    const a = team.players.reduce((s, p) => s + p.assists, 0);
    return (
      `<div class="md-team ${win ? "win" : "loss"}">` +
        `<div class="md-team-head">` +
          `<span class="md-team-name">${ordinal(team.placement)} PLACE</span>` +
          `<span class="md-team-kills">${k} / ${d} / ${a}</span>` +
          `<span class="md-objs"><span>Team <b>${team.subteamId}</b></span></span>` +
        `</div>` +
        team.players.map((p) => detailRow(p, meId, maxDmg, win)).join("") +
      `</div>`
    );
  }

  function renderMatchDetail(raw) {
    const info = raw.info;
    const meId = state.account.puuid;
    const me = info.participants.find((p) => p.puuid === meId);
    const maxDmg = Math.max(
      1,
      ...info.participants.map((p) => p.totalDamageDealtToChampions || 0)
    );
    const endTs =
      info.gameEndTimestamp || (info.gameStartTimestamp + info.gameDuration * 1000);
    const durMin = Math.round(info.gameDuration / 60);

    const arena = isArenaMatch(info);

    let summary = "Match details";
    if (me) {
      const kda = ((me.kills + me.assists) / Math.max(1, me.deaths)).toFixed(2);
      const myPlace = me.subteamPlacement ?? me.placement;
      const result = arena
        ? `<span class="${myPlace <= 4 ? "win" : "loss"}">${ordinal(myPlace)} PLACE</span>`
        : `<span class="${me.win ? "win" : "loss"}">${me.win ? "VICTORY" : "DEFEAT"}</span>`;
      summary =
        result +
        `<span class="dot">&middot;</span>${escapeHtml(championNameById(me.championId))}` +
        `<span class="dot">&middot;</span>${me.kills}/${me.deaths}/${me.assists} (${kda} KDA)` +
        `<span class="dot">&middot;</span>${escapeHtml(queueName(info.queueId))}` +
        `<span class="dot">&middot;</span>${durMin} min` +
        `<span class="dot">&middot;</span>${timeAgo(endTs)}` +
        `<span class="dot"> &middot;</span>${info.queueId}`;
        `<span class="dot"> &middot;</span>${state.region}_${info.gameId}`;
    }

    const teamsHtml = arena
      ? groupArenaTeams(info).map((t) => arenaTeamBlock(t, meId, maxDmg)).join("")
      : teamBlock(info, 100, meId, maxDmg) + teamBlock(info, 200, meId, maxDmg);

    el.detail.innerHTML =
      `<div class="md-bar">` +
        `<button class="md-back" type="button">← Back</button>` +
        `<div class="md-summary">${summary}</div>` +
      `</div>` +
      teamsHtml;

    el.detail.querySelector(".md-back").addEventListener("click", restoreListView);
    el.detail
      .querySelectorAll(".md-champ img")
      .forEach((img) => { img.onerror = () => img.remove(); });
  }

  // Click handler for a match row: swap the history list for the full scoreboard.
  async function showMatchDetail(matchId) {
    let raw = state.raw.get(matchId);
    if (!raw) {
      try {
        raw = await fetchMatch(matchId, state.region);
        state.raw.set(matchId, raw);
      } catch (e) {
        console.warn("Match detail load failed", matchId, e);
        return;
      }
    }
    el.head.style.display = "none";
    el.list.style.display = "none";
    el.pager.style.display = "none";
    renderMatchDetail(raw);
    el.detail.hidden = false;
    el.detail.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }

  async function getMatch(id) {
    if (state.cache.has(id)) return state.cache.get(id);
    let parsed = null;
    try {
      const raw = await fetchMatch(id, state.region);
      state.raw.set(id, raw);
      parsed = parseMatch(raw, state.account.puuid);
      if (parsed) parsed.matchId = id;
    } catch (e) {
      console.warn("Match load failed", id, e);
    }
    state.cache.set(id, parsed);
    if (parsed) {
      state.seen.total += 1;
      if (parsed.win) state.seen.wins += 1;
    }
    return parsed;
  }

  // ---- pagination ----
  function pageNumbers(current, total) {
    const out = new Set([0, total - 1, current - 1, current, current + 1]);
    const pages = [...out].filter((p) => p >= 0 && p < total).sort((a, b) => a - b);
    const withGaps = [];
    let prev = null;
    for (const p of pages) {
      if (prev !== null && p - prev > 1) withGaps.push("...");
      withGaps.push(p);
      prev = p;
    }
    return withGaps;
  }

  function renderPager() {
    const total = Math.ceil(state.ids.length / PER_PAGE);
    el.pager.innerHTML = "";
    if (total <= 1) return;

    const mk = (label, page, opts = {}) => {
      const b = document.createElement("button");
      b.textContent = label;
      if (opts.active) b.classList.add("active");
      if (opts.disabled) b.disabled = true;
      else b.addEventListener("click", () => showPage(page));
      return b;
    };

    el.pager.appendChild(mk("«", 0, { disabled: state.page === 0 }));
    el.pager.appendChild(mk("‹", state.page - 1, { disabled: state.page === 0 }));
    for (const item of pageNumbers(state.page, total)) {
      if (item === "...") {
        const span = document.createElement("span");
        span.className = "ellipsis";
        span.textContent = "…";
        el.pager.appendChild(span);
      } else {
        el.pager.appendChild(mk(String(item + 1), item, { active: item === state.page }));
      }
    }
    el.pager.appendChild(mk("›", state.page + 1, { disabled: state.page === total - 1 }));
    el.pager.appendChild(mk("»", total - 1, { disabled: state.page === total - 1 }));
  }

  async function showPage(page) {
    restoreListView(); // in case the detail scoreboard was open
    state.page = page;
    const start = page * PER_PAGE;
    const ids = state.ids.slice(start, start + PER_PAGE);

    el.list.innerHTML = '<div class="match-empty">Loading matches…</div>';
    const parsed = (await Promise.all(ids.map(getMatch))).filter(Boolean);

    el.list.innerHTML = "";
    if (parsed.length === 0) {
      el.list.innerHTML = '<div class="match-error">Could not load these matches.</div>';
    } else {
      parsed.forEach((m) => el.list.appendChild(matchRow(m)));
    }

    el.meta.textContent =
      `${state.ids.length} games · showing ${start + 1}-${start + ids.length}`;
    if (!state.ranked) renderCard(parsed[0] || null); // refresh fallback win rate + icon
    renderPager();
    el.list.scrollTop = 0;
  }

  // ---- public entry ----
  async function load(account, region) {
    state.account = account;
    state.region = region;
    state.cache.clear();
    state.raw.clear();
    state.seen = { wins: 0, total: 0 };
    state.page = 0;
    restoreListView();

    // Match ids (throws on hard failure → handled by caller) + ranked and
    // challenges (both best-effort; a failure here must not block login).
    const [ids, ranked, challenges] = await Promise.all([
      fetchMatchIds(account.puuid, region, 0, ID_LIMIT),
      fetchRankedEntry(account.puuid, region),
      fetchChallenges(account.puuid, region).catch(() => null),
    ]);
    state.ids = ids || [];
    state.ranked = ranked;
    state.challengeLevel = challenges?.totalPoints?.level || null;

    if (state.ids.length === 0) {
      el.list.innerHTML = '<div class="match-empty">No recent matches found.</div>';
      el.meta.textContent = "0 games";
      el.pager.innerHTML = "";
      renderCard(null);
      return;
    }

    await showPage(0);
    renderCard(state.cache.get(state.ids[0]) || null);
  }

  return { load };
}
