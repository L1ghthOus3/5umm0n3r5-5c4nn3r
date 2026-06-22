// Champion Dex: a browsable, searchable champion database built on the local
// champion.json dump plus Data Dragon assets. The whole feature lives on one
// page (champion-dex.html) driven by initDex(): no fragment shows the search
// grid, a "#<Champion>" fragment shows that champion's detail card.
//
// Routing is hash-based on purpose — the fragment never reaches the server, so
// links like champion-dex.html#Akali (→ /champion-dex#Akali under Vercel
// cleanUrls) resolve on any host (Vercel, Express, python http.server) with no
// rewrite or build step.
//
// Data is real Data Dragon static data: the grid uses the summary champion.json
// (repo root); the detail view additionally fetches the per-champion en_US file
// from the CDN for lore, base stats, and the ability kit.

const DDRAGON = "https://ddragon.leagueoflegends.com/cdn";

// Hue per primary role, reused from the login console's dex mock so the detail
// hero tints match the rest of the app's palette.
const ROLE_HUE = {
  Assassin: 345, Mage: 278, Marksman: 42, Fighter: 18,
  Tank: 205, Support: 150, Bruiser: 8, Specialist: 190,
};

let _version = "";
let _summaries = null; // [{id,name,title,tags,info,image}, …] sorted by name

function escapeHtml(s) {
  return String(s ?? "").replace(/[&<>"']/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}

// Load the summary dump once. Uses a root-absolute path so both the landing
// page and the nested detail page resolve the same file.
async function loadSummaries() {
  if (_summaries) return _summaries;
  const res = await fetch("/champion.json");
  if (!res.ok) throw new Error(`champion.json ${res.status}`);
  const json = await res.json();
  _version = json.version || "";
  _summaries = Object.values(json.data).sort((a, b) =>
    a.name.localeCompare(b.name));
  return _summaries;
}

const iconUrl = (imgFull) => `${DDRAGON}/${_version}/img/champion/${imgFull}`;
const spellIconUrl = (imgFull) => `${DDRAGON}/${_version}/img/spell/${imgFull}`;
const passiveIconUrl = (imgFull) => `${DDRAGON}/${_version}/img/passive/${imgFull}`;
const loadingArtUrl = (id) => `${DDRAGON}/img/champion/loading/${id}_0.jpg`;

const roleHue = (tags) => ROLE_HUE[(tags && tags[0]) || ""] ?? 205;

// Hash link for a champion id, e.g. "Akali" -> "#Akali".
const detailHash = (id) => `#${encodeURIComponent(id)}`;

// Champion currently requested by the URL fragment (decoded, trimmed).
function hashChampion() {
  return decodeURIComponent((location.hash || "").replace(/^#/, "")).trim();
}

// Difficulty (0-10 Data Dragon rating) -> 1/2/3 dots + label.
function difficulty(info) {
  const d = (info && info.difficulty) || 0;
  const level = d <= 3 ? 1 : d <= 6 ? 2 : 3;
  const label = ["", "Low", "Moderate", "High"][level];
  return { raw: d, level, label };
}

/* ===================================================================
   Controller: one page, hash-routed between grid and detail
   =================================================================== */
export async function initDex() {
  const browse = document.getElementById("dexBrowse");
  const detail = document.getElementById("dexDetail");
  const grid = document.getElementById("dexGrid");
  const champRoot = document.getElementById("champDetail");
  if (!browse || !detail || !grid || !champRoot) return;

  const input = document.getElementById("dexInput");
  const form = document.getElementById("dexForm");
  const filters = document.getElementById("dexFilters");
  const meta = document.getElementById("dexMeta");
  const back = document.getElementById("dexBack");

  let champs;
  try {
    champs = await loadSummaries();
  } catch (e) {
    console.error("Failed to load champions", e);
    grid.innerHTML = `<div class="dex-error">! could not load champion data</div>`;
    return;
  }

  // ---- grid: search + role filter (wired once) ----
  const ROLE_ORDER = ["Fighter", "Tank", "Mage", "Assassin", "Marksman", "Support"];
  const roles = ROLE_ORDER.filter((r) => champs.some((c) => c.tags.includes(r)));
  let activeRole = "";
  filters.innerHTML =
    `<span class="dex-filters-lbl">ROLE</span>` +
    `<button class="dex-chip active" data-role="">ALL</button>` +
    roles.map((r) => `<button class="dex-chip" data-role="${escapeHtml(r)}">${escapeHtml(r)}</button>`).join("");

  function renderGrid() {
    const q = (input.value || "").trim().toLowerCase();
    const list = champs.filter((c) =>
      (!activeRole || c.tags.includes(activeRole)) &&
      (!q || c.name.toLowerCase().includes(q) || c.id.toLowerCase().includes(q)));

    meta.innerHTML = `<b>${list.length}</b> champion${list.length === 1 ? "" : "s"}` +
      (activeRole ? ` &middot; ${escapeHtml(activeRole)}` : "") +
      (q ? ` &middot; "${escapeHtml(q)}"` : "");

    if (!list.length) {
      grid.innerHTML = `<div class="dex-empty">no champions match<span class="blink"> _</span></div>`;
      return;
    }
    grid.innerHTML = list.map((c) => {
      const role = (c.tags || []).join(" / ") || "—";
      return `<a class="dex-champ" href="${detailHash(c.id)}">` +
        `<img loading="lazy" alt="${escapeHtml(c.name)}" src="${iconUrl(c.image.full)}">` +
        `<div class="dc-text">` +
        `<div class="dc-name">${escapeHtml(c.name)}</div>` +
        `<div class="dc-role">${escapeHtml(role)}</div>` +
        `</div></a>`;
    }).join("");
  }

  filters.addEventListener("click", (e) => {
    const btn = e.target.closest(".dex-chip");
    if (!btn) return;
    activeRole = btn.dataset.role || "";
    filters.querySelectorAll(".dex-chip").forEach((b) =>
      b.classList.toggle("active", b === btn));
    renderGrid();
  });

  input.addEventListener("input", renderGrid);
  // Submitting jumps straight to an exact match (via the hash), else filters.
  form.addEventListener("submit", (e) => {
    e.preventDefault();
    const q = (input.value || "").trim().toLowerCase();
    const exact = champs.find((c) =>
      c.name.toLowerCase() === q || c.id.toLowerCase() === q);
    if (exact) {
      location.hash = detailHash(exact.id);
    } else {
      renderGrid();
    }
  });

  // Back: drop the fragment (keep path/query) so route() shows the grid again.
  if (back) {
    back.addEventListener("click", () => {
      history.pushState("", document.title, location.pathname + location.search);
      route();
    });
  }

  // ---- detail: render the champion named in the hash ----
  // A token guards against an older (slower) CDN fetch overwriting a newer view
  // when the user clicks through champions quickly.
  let detailToken = 0;
  async function renderDetail(wanted) {
    const token = ++detailToken;
    const wl = wanted.toLowerCase();
    const summary = champs.find((c) =>
      c.id.toLowerCase() === wl || c.name.toLowerCase() === wl);
    if (!summary) {
      document.title = "Champion Dex";
      champRoot.innerHTML = `<div class="dex-error">! unknown champion "${escapeHtml(wanted)}"</div>`;
      return;
    }

    document.title = `${summary.name} — Champion Dex`;
    champRoot.innerHTML = `<div class="dex-loading">loading ${escapeHtml(summary.name)}<span class="blink"> _</span></div>`;

    // The summary dump lacks spells/lore/base stats; pull the full per-champion
    // file. Fall back to the summary alone if the CDN call fails.
    let full = null;
    try {
      const res = await fetch(`${DDRAGON}/${_version}/data/en_US/champion/${summary.id}.json`);
      if (res.ok) {
        const json = await res.json();
        full = json.data && json.data[summary.id];
      }
    } catch (e) {
      console.warn("Falling back to summary data for", summary.id, e);
    }
    if (token !== detailToken) return; // a newer champion was requested
    champRoot.innerHTML = renderChampion(summary, full);
  }

  // ---- routing ----
  function route() {
    const wanted = hashChampion();
    if (wanted) {
      browse.hidden = true;
      detail.hidden = false;
      window.scrollTo(0, 0);
      renderDetail(wanted);
    } else {
      detail.hidden = true;
      browse.hidden = false;
      document.title = "Champion Dex";
      renderGrid();
    }
  }

  window.addEventListener("hashchange", route);
  route();
}

function renderChampion(summary, full) {
  const data = full || summary;
  const name = data.name;
  const title = data.title || "";
  const tags = data.tags || [];
  const info = data.info || {};
  const hue = roleHue(tags);
  const diff = difficulty(info);

  const tagsHtml = tags.map((t, i) =>
    `<span class="cc-tag${i === 0 ? " role" : ""}">${escapeHtml(t)}</span>`).join("") +
    (data.partype ? `<span class="cc-tag">${escapeHtml(data.partype)}</span>` : "");

  const dots = [1, 2, 3].map((i) =>
    `<i class="${i <= diff.level ? "on" : ""}"></i>`).join("");

  // Combat ratings (Data Dragon info, each out of 10).
  const ratings = [
    ["ATTACK", info.attack], ["DEFENSE", info.defense],
    ["MAGIC", info.magic], ["DIFFICULTY", info.difficulty],
  ];
  const statsHtml = ratings.map(([k, v]) => {
    const n = v || 0;
    return `<div class="cc-stat"><div class="v">${n}<small>/10</small></div>` +
      `<div class="k">${k}</div>` +
      `<div class="bar"><i style="width:${n * 10}%"></i></div></div>`;
  }).join("");

  const abilitiesHtml = renderAbilities(full);
  const baseStatsHtml = renderBaseStats(full);
  const lore = full ? (full.lore || full.blurb || "") : (summary.blurb || "");

  const heroArt = `<div class="cc-hero-art" style="background-image:url('${loadingArtUrl(data.id)}')"></div>`;

  return `<div class="champ-card">
    <div class="cc-hero" style="--ch-hue:${hue}deg; --tier: var(--cyan)">
      ${heroArt}
      <div class="cc-portrait" style="--tier: var(--cyan)">
        <img alt="${escapeHtml(name)}" src="${iconUrl(data.image.full)}">
      </div>
      <div class="cc-id">
        <h1 class="cc-name">${escapeHtml(name)}</h1>
        ${title ? `<div class="cc-title">${escapeHtml(title)}</div>` : ""}
        <div class="cc-tags">${tagsHtml}</div>
        <div class="cc-diff">
          <span class="lbl">DIFFICULTY</span>
          <span class="dots">${dots}</span>
          <span class="dv">${escapeHtml(diff.label)}</span>
        </div>
      </div>
      <div class="cc-hero-big">${diff.raw}<small>/10</small><span>DIFFICULTY</span></div>
    </div>

    <div class="cc-stats">${statsHtml}</div>

    <div class="cc-cols">
      <div class="cc-block">
        <div class="cc-block-h">ABILITIES</div>
        ${abilitiesHtml}
      </div>
      <div class="cc-side">
        <div class="cc-block">
          <div class="cc-block-h">BASE STATS</div>
          ${baseStatsHtml}
        </div>
        ${lore ? `<div class="cc-block">
          <div class="cc-block-h">LORE</div>
          <div class="cc-lore">${escapeHtml(lore)}</div>
        </div>` : ""}
      </div>
    </div>
  </div>`;
}

function renderAbilities(full) {
  if (!full || !full.spells) {
    return `<div class="cc-lore">Ability details are unavailable right now.</div>`;
  }
  const rows = [];
  if (full.passive) {
    rows.push({
      key: "P", name: full.passive.name,
      ico: full.passive.image && passiveIconUrl(full.passive.image.full),
      cd: null,
    });
  }
  const slots = ["Q", "W", "E", "R"];
  full.spells.slice(0, 4).forEach((sp, i) => {
    rows.push({
      key: slots[i], name: sp.name,
      ico: sp.image && spellIconUrl(sp.image.full),
      cd: sp.cooldownBurn && sp.cooldownBurn !== "0" ? sp.cooldownBurn + "s" : null,
    });
  });
  return `<div class="cc-abils">` + rows.map((a) =>
    `<div class="cc-abil">` +
    `<span class="key">${a.key}</span>` +
    (a.ico ? `<img class="ico" alt="" loading="lazy" src="${a.ico}">` : `<span class="ico"></span>`) +
    `<span class="nm">${escapeHtml(a.name)}</span>` +
    `<span class="cd">${a.cd ? escapeHtml(a.cd) : "—"}</span>` +
    `</div>`).join("") + `</div>`;
}

function renderBaseStats(full) {
  if (!full || !full.stats) {
    return `<div class="cc-lore">Base stats are unavailable right now.</div>`;
  }
  const s = full.stats;
  const round = (n) => Math.round((n + Number.EPSILON) * 100) / 100;
  const rows = [
    ["Health", round(s.hp)],
    ["Attack Dmg", round(s.attackdamage)],
    ["Armor", round(s.armor)],
    ["Magic Resist", round(s.spellblock)],
    ["Move Speed", round(s.movespeed)],
    ["Attack Range", round(s.attackrange)],
    [full.partype || "Resource", round(s.mp)],
    ["Attack Speed", round(s.attackspeed)],
  ];
  return `<div class="cc-basestats">` + rows.map(([k, v]) =>
    `<div class="cc-bs"><span class="bk">${escapeHtml(k)}</span>` +
    `<span class="bv">${escapeHtml(v)}</span></div>`).join("") + `</div>`;
}
