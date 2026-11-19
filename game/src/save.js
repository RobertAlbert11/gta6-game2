// Save/load: three slots in localStorage, JSON-serialized player + mission progress.

const KEY = 'neon-coast-save-';
const META = 'neon-coast-meta';

export function saveGame(slot, state) {
  const p = state.player;
  const data = {
    v: 1, when: Date.now(),
    player: {
      x: p.x, y: p.y, hp: p.hp, armor: p.armor, money: p.money, weapon: p.weapon,
      ammo: p.ammo, wanted: p.wanted, kills: p.kills, jacked: p.jacked,
      missionsDone: p.missionsDone, packages: p.packages, racesWon: p.racesWon,
      rampages: p.rampages, jumps: p.jumps, deliveries: p.deliveries, fish: p.fish,
      blackjackWins: p.blackjackWins, aimScore: p.aimScore, chessWins: p.chessWins,
      stamina: p.stamina,
    },
    clock: state.clock, day: state.day,
    ongoing: {
      raceNext: state._race ? state._race.next : null,
      rampageKills: state._rampage ? state._rampage.kills : null,
    },
    missions: {
      completed: [...missionStateRef().completed],
      nextIndex: missionStateRef().nextIndex,
    },
    activities: activitiesDoneRef(),
  };
  localStorage.setItem(KEY + slot, JSON.stringify(data));
  localStorage.setItem(META, JSON.stringify({ last: slot }));
  return data;
}

export function loadGame(slot, state) {
  const raw = localStorage.getItem(KEY + slot);
  if (!raw) return null;
  try {
    const data = JSON.parse(raw);
    const p = state.player;
    Object.assign(p, data.player);
    p.stamina = data.player.stamina ?? 100;
    state.clock = data.clock;
    state.day = data.day;
    // ongoing events are dropped on load: mid-race saves resume at free roam
    state._race = null; state._delivery = null; state._rampage = null;
    const ms = missionStateRef();
    ms.completed = new Set(data.missions.completed);
    ms.nextIndex = data.missions.nextIndex;
    applyActivitiesDone(data.activities);
    return data;
  } catch {
    return null;
  }
}

export function slotInfo(slot) {
  const raw = localStorage.getItem(KEY + slot);
  if (!raw) return null;
  try {
    const d = JSON.parse(raw);
    return { when: d.when, money: d.player.money, missions: d.player.missionsDone };
  } catch { return null; }
}

// Late-bound refs avoid a circular import with missions.js.
let _ms = null, _acts = null;
export function bindRefs(missions, activities) {
  _ms = missions;
  _acts = activities;
}
function missionStateRef() { return _ms; }
function activitiesDoneRef() {
  return _acts.filter((a) => a.kind === 'collect' && a.done).map((a) => a.id);
}
function applyActivitiesDone(ids) {
  if (!ids || !_acts) return;
  const set = new Set(ids);
  for (const a of _acts) if (set.has(a.id)) a.done = true;
}
