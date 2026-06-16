// Champion static data loaded from the local champion.json, plus Data Dragon
// asset helpers. The mastery API's numeric championId matches each champion's "key".

export const champById = {}; // 266 -> { id: "Aatrox", name: "Aatrox", img: "Aatrox.png" }
let ddragonVersion = "";     // e.g. "16.11.1" — used to build Data Dragon asset URLs

export async function loadChampions() {
  try {
    const res = await fetch("champion.json");
    const json = await res.json();
    ddragonVersion = json.version || "";
    for (const champ of Object.values(json.data)) {
      champById[Number(champ.key)] = {
        id: champ.id,
        name: champ.name,
        img: champ.image && champ.image.full,
      };
    }
  } catch (e) {
    console.error("Failed to load champion.json", e);
  }
}

// Data Dragon champion square icon. https://developer.riotgames.com/docs/lol#data-dragon_champions
export function championIconUrl(imgFull) {
  return `https://ddragon.leagueoflegends.com/cdn/${ddragonVersion}/img/champion/${imgFull}`;
}

// Data Dragon summoner profile icon.
export function profileIconUrl(iconId) {
  return `https://ddragon.leagueoflegends.com/cdn/${ddragonVersion}/img/profileicon/${iconId}.png`;
}

// Data Dragon item icon (itemId 0 = empty slot).
export function itemIconUrl(itemId) {
  if (!itemId) return null;
  return `https://ddragon.leagueoflegends.com/cdn/${ddragonVersion}/img/item/${itemId}.png`;
}

// CommunityDragon challenge token icon for a given challenge level.
// `level` is the ChallengeInfoDto level (BRONZE, PLATINUM, …); the asset
// path wants it lowercased.
export function challengeIconUrl(challengeId, level) {
  if (challengeId == null || !level) return null;
  return (
    `https://raw.communitydragon.org/latest/game/assets/challenges/config/` +
    `${encodeURIComponent(challengeId)}/tokens/${String(level).toLowerCase()}.png`
  );
}

// Champion square icon by numeric championId (from match/mastery data).
export function championIconById(championId) {
  const champ = champById[championId];
  return champ && champ.img ? championIconUrl(champ.img) : null;
}

export function championNameById(championId) {
  const champ = champById[championId];
  return champ ? champ.name : `Champion ${championId}`;
}
