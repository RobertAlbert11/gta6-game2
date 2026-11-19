// Story missions (12) + side activities (60+) for Neon Coast.

import { WEAPONS, dist, dist2, angleTo, rng, money$ } from './config.js';
import { T, CITY_W, CITY_H, roadsX, roadsY } from './world.js';
import { spawnGangster, spawnTrafficCar, dropPickup, puff, addHeat, damageEnemy } from './entities.js';
import { sfx } from './audio.js';

const R = rng(424242);

// Named spots used by missions and activities. Populated by setupActivities.
export const spots = {};

export function initSpots(world) {
  spots.solGarage = { x: roadsX[4] + 30, y: roadsY[3] + 30, name: "Sol's Garage" };
  spots.ticoBar = { x: roadsX[13] + 30, y: roadsY[2] + 30, name: 'The Velvet Room' };
  spots.dockWarehouse = { x: roadsX[3] + 30, y: roadsY[14] + 30, name: 'Pier Warehouse' };
  spots.casino = { x: roadsX[14] + 30, y: roadsY[6] + 30, name: "Lucky 7 Casino" };
  spots.krossTower = { x: roadsX[21] + 30, y: roadsY[4] + 30, name: 'Kross Tower' };
  spots.paySpray = { x: roadsX[9] + 30, y: roadsY[12] + 30, name: "Pay'N'Spray" };
  spots.hospital = { x: roadsX[19] + 30, y: roadsY[10] + 30, name: 'St. Aurelia' };
  spots.raceStart = { x: roadsX[8], y: roadsY[16] };
  spots.fishing = { x: CITY_W / 2, y: roadsY[19] + 90 };
  spots.boardwalk = { x: roadsX[6] + 20, y: roadsY[19] + 20 };
  spots.aimRange = { x: roadsX[22] + 30, y: roadsY[13] + 30 };
  spots.chessTable = { x: roadsX[2] + 20, y: roadsY[6] + 20 };
}

// ---------------------------------------------------------------- mission engine
// A mission is: { id, title, giver, brief[], steps[] }. A step is an object:
//   { text, update(s,dt,api) -> 'done'|'fail'|null, blip(s) -> {x,y}, timer? }
// api: { toast, banner, money, heat, spawnGang, target, dialog }

export const MISSIONS = [
  {
    id: 'm1', title: 'Back in the Saddle', giver: 'solGarage', from: 'Sol',
    brief: ["Rio! Your old garage still has your name on the spray can.", "A courier skimmed from me. Retrieve my package from his car and bring it home."],
    steps: [
      { text: 'Steal any car', check(s) { return !!s.player.inCar; } },
      { text: 'Collect the package', setup(s, api) { api.pickup(spots.pickupM1.x, spots.pickupM1.y, 'package'); }, blip() { return spots.pickupM1; }, check(s) { return s.player.packages > s._m1pk; }, init(s) { s._m1pk = s.player.packages; } },
      { text: "Deliver it to Sol's Garage", blip() { return spots.solGarage; }, check: nearCheck(() => spots.solGarage) },
    ],
    reward: 400,
  },
  {
    id: 'm2', title: 'Velvet Complications', giver: 'solGarage', from: 'Sol',
    brief: ["Tico owes the wrong people money again.", "Cover him at the Velvet Room while he settles up. Ember Hand enforcers will object."],
    steps: [
      { text: 'Meet Tico at the Velvet Room', blip() { return spots.ticoBar; }, check: nearCheck(() => spots.ticoBar), setup(s, api) { api.spawnGang(spots.ticoBar.x - 120, spots.ticoBar.y + 90, 3); } },
      { text: 'Defeat the enforcers', check(s) { return !s.enemies.some((e) => e.alive && e.kind === 'gang'); } },
      { text: 'Lose the heat', check(s) { return s.player.wanted < 1; }, failIf(s) { return false; } },
    ],
    reward: 600,
  },
  {
    id: 'm3', title: 'Dockside Audit', giver: 'ticoBar', from: 'Tico',
    brief: ["Kross's crew runs stolen parts through the pier warehouse.", "Photograph three crates for the D.A. who owes me. Snap them, get out."],
    steps: [
      { text: 'Photograph crate 1', setup(s, api) { s._m3 = 0; }, blip() { return spots.crate1; }, check(s) { return s._m3 >= 1; } },
      { text: 'Photograph crate 2', blip() { return spots.crate2; }, check(s) { return s._m3 >= 2; } },
      { text: 'Photograph crate 3', blip() { return spots.crate3; }, check(s) { return s._m3 >= 3; } },
      { text: 'Escape the warehouse crew', setup(s, api) { api.spawnGang(spots.crate1.x, spots.crate1.y, 4); }, check(s) { return dist2(s.player.x, s.player.y, spots.dockWarehouse.x, spots.dockWarehouse.y) > 800 * 800; } },
    ],
    reward: 700,
  },
  {
    id: 'm4', title: 'Hot Wheels', giver: 'ticoBar', from: 'Tico',
    brief: ["A collector wants a specific ride before midnight.", "The silver sport car parked outside Kross Tower. They will chase."],
    steps: [
      { text: 'Steal the marked sport car', setup(s, api) { s._m4car = spawnMarked(s, spots.krossTower, '#c0c8d4', 'sport'); }, blip() { return s._m4car; }, check(s) { return s.player.inCar === s._m4car; } },
      { text: 'Deliver it to the docks garage', blip() { return spots.dockWarehouse; }, check: nearCheck(() => spots.dockWarehouse), failIf(s) { return !s._m4car.alive; } },
    ],
    reward: 800,
  },
  {
    id: 'm5', title: 'Payback Delivery', giver: 'dockWarehouse', from: 'Sol',
    brief: ["The D.A. wants evidence. I want a message.", "Drive this... gift to Kross Tower's front desk. Do not open it."],
    steps: [
      { text: 'Take the package (any car)', init(s) { s._m5pk = s.player.packages; }, check(s) { return s.player.packages > s._m5pk; } },
      { text: 'Deliver to Kross Tower lobby', blip() { return spots.krossTower; }, check: nearCheck(() => spots.krossTower) },
      { text: 'Get clear before it opens (100m)', blip() { return spots.krossTower; }, check(s) { return dist2(s.player.x, s.player.y, spots.krossTower.x, spots.krossTower.y) > 100 * 100; } },
    ],
    reward: 900,
  },
  {
    id: 'm6', title: 'Sirens in the Rain', giver: 'dockWarehouse', from: 'Tico',
    brief: ["The VPD has a witness in protective transit.", "Sol wants him... relocated. Hit the cruiser, then lose every star."],
    steps: [
      { text: 'Wreck the police cruiser', setup(s, api) { s._m6car = spawnPoliceTarget(s); }, blip() { return s._m6car; }, check(s) { return !s._m6car.alive; } },
      { text: 'Lose the wanted level', check(s) { return s.player.wanted < 1; } },
    ],
    reward: 1000,
  },
  {
    id: 'm7', title: 'Casino Nights', giver: 'ticoBar', from: 'Sol',
    brief: ["The Lucky 7 skims for Kross. Hit their counting room.", "Win big at the table to get invited to the back. Then persuade the cashier."],
    steps: [
      { text: 'Win a hand of blackjack', blip() { return spots.casino; }, init(s) { s._m7w = s.player.blackjackWins + 1; }, check(s) { return s.player.blackjackWins >= s._m7w; } },
      { text: 'Persuade the cashier', setup(s, api) { api.spawnGang(spots.casino.x + 80, spots.casino.y + 60, 3); }, check(s) { return !s.enemies.some((e) => e.alive && e.kind === 'gang'); } },
      { text: 'Leave with the take', check(s) { return dist2(s.player.x, s.player.y, spots.casino.x, spots.casino.y) > 500 * 500; } },
    ],
    reward: 1200,
  },
  {
    id: 'm8', title: 'Ember Ambush', giver: 'ticoBar', from: 'Tico',
    brief: ["Kross knows your face now. He sent a welcoming party.", "Survive the ambush at Palm Heights park. Make it hurt."],
    steps: [
      { text: 'Survive at the park', setup(s, api) { api.spawnGang(s.player.x + 150, s.player.y, 5); api.spawnGang(s.player.x - 150, s.player.y + 80, 3); }, check(s, api) { return s._ambushT > 45; }, init(s) { s._ambushT = 0; }, update(s, dt) { s._ambushT += dt; } },
    ],
    reward: 1400,
  },
  {
    id: 'm9', title: 'The Long Haul', giver: 'dockWarehouse', from: 'Sol',
    brief: ["Truck of contraband coming up the coast road.", "Jack the truck, keep it in one piece, bring it to the boardwalk."],
    steps: [
      { text: 'Steal the van', setup(s, api) { s._m9car = spawnMarked(s, spots.crate1, '#8a8f99', 'van'); }, blip() { return s._m9car; }, check(s) { return s.player.inCar === s._m9car; } },
      { text: 'Deliver to the boardwalk', blip() { return spots.boardwalk; }, check: nearCheck(() => spots.boardwalk), failIf(s) { return !s._m9car.alive; } },
    ],
    reward: 1500,
  },
  {
    id: 'm10', title: 'Badge of Dishonor', giver: 'solGarage', from: 'Sol',
    brief: ["Captain Reyes sells routes to Kross. Here is proof.", "Meet our insider, take the ledger, and vanish before the swap turns loud."],
    steps: [
      { text: 'Meet the insider at the aim range', blip() { return spots.aimRange; }, check: nearCheck(() => spots.aimRange), setup(s, api) { api.spawnGang(spots.aimRange.x + 100, spots.aimRange.y, 2); } },
      { text: 'Take the ledger', check(s) { return !s.enemies.some((e) => e.alive && e.kind === 'gang'); } },
      { text: 'Lose the heat', check(s) { return s.player.wanted < 1; } },
    ],
    reward: 1700,
  },
  {
    id: 'm11', title: 'Storm the Tower', giver: 'solGarage', from: 'Tico',
    brief: ["Enough foreplay. Kross runs his operation from the tower top.", "Fight to the entrance. Sol will handle the elevators."],
    steps: [
      { text: 'Break through the guards', setup(s, api) { api.spawnGang(spots.krossTower.x - 60, spots.krossTower.y - 80, 4); api.spawnGang(spots.krossTower.x + 90, spots.krossTower.y + 40, 4); }, check(s) { return !s.enemies.some((e) => e.alive && e.kind === 'gang'); } },
      { text: 'Reach the tower lobby', blip() { return spots.krossTower; }, check: nearCheck(() => spots.krossTower) },
    ],
    reward: 2000,
  },
  {
    id: 'm12', title: 'The Last Neon Light', giver: 'krossTower', from: 'Rio',
    brief: ["Just you and Damien Kross now.", "He is in the penthouse. End the Ember Hand tonight."],
    steps: [
      { text: 'Defeat Damien Kross', setup(s, api) { s._kross = spawnGangster(s, spots.krossTower.x + 40, spots.krossTower.y + 40); s._kross.hp = 260; s._kross.shirt = '#f1f3f7'; s._kross.isKross = true; }, blip(s) { return s._kross; }, check(s) { return !s._kross || !s._kross.alive; } },
    ],
    reward: 5000,
  },
];

function nearCheck(spotFn) {
  return (s) => dist2(s.player.x, s.player.y, spotFn().x, spotFn().y) < 55 * 55;
}

function spawnMarked(s, spot, color, vtype) {
  const c = spawnTrafficCar(s, { x: spot.x + 70, y: spot.y + 50, dir: 0 });
  c.color = color; c.vtype = vtype; c.len = vtype === 'van' ? 34 : 28;
  c._marked = true;
  return c;
}

function spawnPoliceTarget(s) {
  const c = spawnTrafficCar(s, { x: s.player.x + 300, y: s.player.y, dir: 0 });
  c.vtype = 'police'; c.color = '#22337a'; c.driver = 'cop'; c.siren = true;
  return c;
}

// ---------------------------------------------------------------- mission runtime

export const missionState = {
  active: null, // { def, stepIndex, stepState }
  completed: new Set(),
  nextIndex: 0,
};

export function startMission(state, def, api) {
  missionState.active = { def, stepIndex: 0, init: false };
  api.dialog(def.from, def.brief.join(' '));
  api.banner('MISSION', def.title);
}

export function updateMission(state, api, dt) {
  const ms = missionState;
  if (!ms.active) {
    // check giver proximity to start the next mission
    const def = MISSIONS[ms.nextIndex];
    if (def) {
      const spot = spots[def.giver];
      if (spot && dist2(state.player.x, state.player.y, spot.x, spot.y) < 55 * 55) {
        startMission(state, def, api);
      }
    }
    return;
  }
  const run = ms.active;
  const step = run.def.steps[run.stepIndex];
  if (!step) return finishMission(state, api);
  if (!run.init) {
    run.init = true;
    if (step.init) step.init(state);
    if (step.setup) step.setup(state, api);
    api.toast('OBJECTIVE: ' + step.text);
  }
  if (step.update) step.update(state, dt, api);
  if (step.failIf && step.failIf(state)) return failMission(state, api);
  if (step.check(state)) {
    run.stepIndex++;
    run.init = false;
    sfx.ui();
    if (run.stepIndex >= run.def.steps.length) finishMission(state, api);
  }
}

function finishMission(state, api) {
  const run = missionState.active;
  missionState.active = null;
  missionState.completed.add(run.def.id);
  missionState.nextIndex = Math.min(MISSIONS.length, MISSIONS.findIndex((d) => d.id === run.def.id) + 1);
  state.player.missionsDone++;
  state.player.money += run.def.reward;
  api.banner('MISSION PASSED', money$(run.def.reward));
  api.toast(run.def.reward > 1500 ? 'The coast belongs to you tonight.' : 'Respect earned on the Neon Coast.');
  sfx.win();
}

function failMission(state, api) {
  missionState.active = null;
  api.banner('MISSION FAILED', 'Walk away. Come back harder.');
  sfx.fail();
}

// ---------------------------------------------------------------- activities (60+)

// Each activity: { id, name, spot:{x,y}, kind, radius, action(state, api) }
// Kinds: 'collect' (auto), 'race', 'deliver', 'rampage', 'stunt', 'casino', 'mini', 'service'
export const ACTIVITIES = [];

function act(id, name, x, y, kind, radius, extra = {}) {
  ACTIVITIES.push({ id, name, x, y, kind, radius, ...extra });
}

export function setupActivities(world, state) {
  ACTIVITIES.length = 0;
  // 1-20: hidden packages scattered across the city
  for (let k = 0; k < 20; k++) {
    const b = world.blocks[Math.floor(R() * world.blocks.length)];
    act('pkg' + k, 'Hidden Package', b.x + (R() - 0.5) * (b.w - 30), b.y + (R() - 0.5) * (b.h - 30), 'collect', 26, { pkg: true });
  }
  // 21-26: street races (loop start markers)
  const raceNames = ['Wharf Sprint', 'Strip Run', 'Palm GP', 'Dock Circuit', 'Sunfield Loop', 'Coast Classic'];
  for (let k = 0; k < 6; k++) {
    const j = 2 + k * 4, i = 4 + (k % 3) * 4;
    act('race' + k, raceNames[k], roadsX[Math.min(j, 25)], roadsY[Math.min(i, 18)], 'race', 40, { laps: 1 });
  }
  // 27-34: delivery runs
  const delNames = ['Flower Run', 'Pizza Rush', 'Pharmacy Drop', 'News Delivery', 'Parts Courier', 'Bakery Run', 'Ice Run', 'Cargo Run'];
  for (let k = 0; k < 8; k++) {
    const j = 1 + k * 3, i = 2 + (k % 4) * 4;
    act('del' + k, delNames[k], roadsX[Math.min(j, 25)], roadsY[Math.min(i, 17)], 'deliver', 36);
  }
  // 35-40: rampages
  for (let k = 0; k < 6; k++) {
    const j = 3 + k * 4, i = 3 + (k % 3) * 5;
    act('ramp' + k, 'Rampage', roadsX[Math.min(j, 25)], roadsY[Math.min(i, 17)], 'rampage', 36);
  }
  // 41-46: stunt jumps (ramp markers)
  for (let k = 0; k < 6; k++) {
    const j = 5 + k * 3, i = 5 + (k % 4) * 3;
    act('jump' + k, 'Stunt Jump', roadsX[Math.min(j, 25)], roadsY[Math.min(i, 17)], 'stunt', 30);
  }
  // 47-52: services + minigames
  act('casino', 'Lucky 7 Casino — Blackjack', spots.casino.x, spots.casino.y, 'casino', 40);
  act('fishing', 'Fishing Pier', spots.fishing.x, spots.fishing.y, 'mini', 44, { mini: 'fish' });
  act('aim', 'Aim Trainer', spots.aimRange.x, spots.aimRange.y, 'mini', 40, { mini: 'aim' });
  act('chess', 'Boardwalk Chess', spots.chessTable.x, spots.chessTable.y, 'mini', 34, { mini: 'chess' });
  act('spray', "Pay'N'Spray — Respray & Repair", spots.paySpray.x, spots.paySpray.y, 'service', 44, { service: 'spray' });
  act('hospital', 'St. Aurelia — Heal', spots.hospital.x, spots.hospital.y, 'service', 40, { service: 'heal' });
  act('armory', 'Pawn Shop — Buy Weapons', spots.ticoBar.x - 60, spots.ticoBar.y + 40, 'service', 40, { service: 'armory' });
  // boardwalk extras: beach vendors, busker, etc.
  for (let k = 0; k < 6; k++) {
    act('vnd' + k, ['Hot Dog Stand', 'Coconut Stand', 'Souvenir Kiosk', 'Busker Tip', ' Tattoo Parlor', 'Beach Volley'][k], 100 + k * (CITY_W - 200) / 5, roadsY[19] + 60, 'mini', 30, { mini: 'vendor' });
  }
  for (const a of ACTIVITIES) {
    a.done = false;
    a.cool = 0;
  }
}

export function updateActivities(state, api, input, dt) {
  const p = state.player;
  for (const a of ACTIVITIES) {
    if (a.cool > 0) a.cool -= dt;
    if (a.done && a.kind === 'collect') continue;
    if (dist2(p.x, p.y, a.x, a.y) > a.radius * a.radius) continue;
    switch (a.kind) {
      case 'collect':
        a.done = true; p.packages++; p.money += 150;
        api.toast('Hidden Package ' + countPkgs(state) + '/20 — $150');
        sfx.pickup();
        break;
      case 'race': if (input.pressed('KeyE')) startRace(state, a, api); break;
      case 'deliver': if (input.pressed('KeyE')) startDelivery(state, a, api); break;
      case 'rampage': if (input.pressed('KeyE')) startRampage(state, a, api); break;
      case 'stunt': checkStunt(state, a, api); break;
      case 'casino': if (input.pressed('KeyE')) playBlackjack(state, api); break;
      case 'mini': if (input.pressed('KeyE')) playMini(state, a, api); break;
      case 'service': doService(state, a, api); break;
    }
  }
  // race/delivery/rampage/mini ongoing updates
  updateRace(state, api, dt);
  updateDelivery(state, api, dt);
  updateRampage(state, api, dt);
}

function countPkgs(state) {
  return ACTIVITIES.filter((a) => a.kind === 'collect' && a.done).length;
}

// ---------------------------------------------------------------- ongoing activities

function startRace(state, a, api) {
  if (!state.player.inCar) { api.toast('Races need a car. Steal one first.'); return; }
  state._race = { a, t: 0, checkpoints: raceCheckpoints(a), next: 0 };
  api.banner('RACE', a.name + ' — hit the checkpoints!');
}

function raceCheckpoints(a) {
  const pts = [];
  for (let k = 0; k < 5; k++) {
    const j = (2 + k * 5) % 26, i = (4 + k * 3) % 19;
    pts.push({ x: roadsX[j], y: roadsY[i] });
  }
  return pts;
}

function updateRace(state, api, dt) {
  const r = state._race;
  if (!r) return;
  r.t += dt;
  const cp = r.checkpoints[r.next];
  if (dist2(state.player.x, state.player.y, cp.x, cp.y) < 60 * 60) {
    r.next++;
    sfx.pickup();
    if (r.next >= r.checkpoints.length) {
      state.player.racesWon++;
      state.player.money += 500;
      api.banner('RACE WON', money$(500) + ' · ' + r.t.toFixed(1) + 's');
      sfx.win();
      state._race = null;
    } else {
      api.toast('Checkpoint ' + r.next + '/' + r.checkpoints.length);
    }
  }
}

function startDelivery(state, a, api) {
  const dest = ACTIVITIES.filter((x) => x.kind === 'deliver' && x !== a);
  const d = dest[Math.floor(R() * dest.length)];
  state._delivery = { a, dest: d, t: 90 };
  api.banner('DELIVERY', a.name + ' — deliver before the timer dies.');
}

function updateDelivery(state, api, dt) {
  const d = state._delivery;
  if (!d) return;
  d.t -= dt;
  if (d.t <= 0) {
    api.toast('Delivery missed. The client fumes.');
    state._delivery = null;
    sfx.fail();
    return;
  }
  if (dist2(state.player.x, state.player.y, d.dest.x, d.dest.y) < 50 * 50) {
    const pay = 300 + Math.floor(d.t * 10);
    state.player.money += pay;
    state.player.deliveries++;
    api.banner('DELIVERED', money$(pay) + ' · ' + d.t.toFixed(0) + 's left');
    sfx.cash();
    state._delivery = null;
  }
}

function startRampage(state, a, api) {
  state._rampage = { a, kills: 0, need: 8, t: 60 };
  api.banner('RAMPAGE', 'Wreck 8 of anything in 60 seconds!');
  for (let k = 0; k < 10; k++) {
    const x = a.x + (R() - 0.5) * 300, y = a.y + (R() - 0.5) * 300;
    spawnGangster(state, x, y);
  }
}

export function noteRampageKill(state) {
  if (state._rampage) state._rampage.kills++;
}

function updateRampage(state, api, dt) {
  const r = state._rampage;
  if (!r) return;
  r.t -= dt;
  if (r.kills >= r.need) {
    state.player.rampages++;
    state.player.money += 600;
    api.banner('RAMPAGE COMPLETE', money$(600));
    sfx.win();
    state._rampage = null;
  } else if (r.t <= 0) {
    api.toast('Rampage failed. Too slow.');
    sfx.fail();
    state._rampage = null;
  }
}

function checkStunt(state, a, api) {
  const p = state.player;
  if (!p.inCar || p._stuntAir) return;
  if (Math.abs(p.inCar.speed) > 240) {
    p._stuntAir = true;
    p._stuntT = 0;
    state._stunt = a;
    puff(state, p.x, p.y, '#ffffff', 6, 40, 0.4, 3);
  }
}

export function updateStunts(state, api, dt) {
  const p = state.player;
  if (!p._stuntAir) return;
  p._stuntT += dt;
  if (!p.inCar || Math.abs(p.inCar.speed) < 100) {
    p._stuntAir = false;
    if (p._stuntT > 0.9) {
      p.jumps++;
      const pay = 200 + Math.floor(p._stuntT * 300);
      p.money += pay;
      api.banner('STUNT JUMP', money$(pay));
      sfx.win();
    }
  }
}

// ---------------------------------------------------------------- minigames + services

function playBlackjack(state, api) {
  const p = state.player;
  const bet = 100;
  if (p.money < bet) { api.toast('Blackjack needs $100. Come back richer.'); return; }
  const card = () => 2 + Math.floor(R() * 10);
  let you = card() + card(), house = card() + card();
  while (you < 17 && R() < 0.55) you += card();
  while (house < 17) house += card();
  const bust = (v) => v > 21;
  p.money -= bet;
  if (bust(you)) { api.toast('Blackjack: you bust with ' + you + '. House takes $100.'); sfx.fail(); }
  else if (bust(house) || you > house) {
    const win = you === 21 ? 350 : 200;
    p.money += win;
    p.blackjackWins++;
    api.toast('Blackjack: ' + you + ' beats ' + house + ' — ' + money$(win - bet) + '!');
    sfx.cash();
  } else { api.toast('Blackjack: ' + house + ' beats ' + you + '. House takes $100.'); sfx.fail(); }
}

function playMini(state, a, api) {
  const p = state.player;
  if (a.mini === 'fish') {
    p.fish++;
    const roll = R();
    if (roll < 0.15) { p.money += 400; api.toast('Reeled in a Marlin! $400.'); sfx.cash(); }
    else if (roll < 0.5) { p.money += 80; api.toast('A fat snapper. $80.'); sfx.cash(); }
    else api.toast('Old boot. The sea keeps its secrets.');
  } else if (a.mini === 'aim') {
    if (p.weapon === 0 || p.weapon === 1) { api.toast('Aim trainer wants a gun. Buy one at the pawn shop.'); return; }
    p.aimScore += 10;
    p.money += 120;
    api.toast('Target drills: ' + p.aimScore + ' points. $120.');
    sfx.pickup();
  } else if (a.mini === 'chess') {
    if (R() < 0.5) { p.chessWins++; p.money += 150; api.toast('Checkmate! The boardwalk regular groans. $150.'); sfx.cash(); }
    else api.toast('Fool\'s mate. He saw it coming.');
  } else if (a.mini === 'vendor') {
    const roll = R();
    if (roll < 0.4) { p.hp = Math.min(100, p.hp + 15); api.toast('Street food. +15 HP.'); }
    else { p.money -= 10; api.toast('Tip the busker. -$10, +karma.'); }
  }
}

function doService(state, a, api) {
  const p = state.player;
  if (a.service === 'spray') {
    if (p.wanted > 0 && p.money >= 400 * p.wanted) {
      p.money -= 400 * Math.floor(p.wanted);
      p.wanted = 0;
      api.toast("Resprayed. The VPD lost your plate.");
      sfx.cash();
    } else if (p.wanted > 0) api.toast("Pay'N'Spray: not enough cash for the bribe.");
    else if (p.inCar) { p.inCar.hp = 100; p.inCar.color = ['#c14b4b', '#4b7bc1', '#57a05e'][Math.floor(R() * 3)]; api.toast('Car repaired and resprayed.'); }
  } else if (a.service === 'heal') {
    if (p.money >= 50 && p.hp < 100) { p.money -= 50; p.hp = 100; api.toast('Patched up at St. Aurelia.'); sfx.pickup(); }
  } else if (a.service === 'armory') {
    if (p.money >= 250 && p.ammo.smg < 40) { p.money -= 250; p.ammo.smg += 40; api.toast('SMG ammo restocked (-$250).'); sfx.pickup(); }
    else if (p.money >= 400 && p.ammo.shotgun < 12) { p.money -= 400; p.ammo.shotgun += 12; api.toast('Shells bought (-$400).'); sfx.pickup(); }
    else if (p.money >= 120 && p.ammo.pistol < 60) { p.money -= 120; p.ammo.pistol += 36; api.toast('Pistol ammo (-$120).'); sfx.pickup(); }
  }
}

// ---------------------------------------------------------------- activity blips + counters

export function activityProgress(state) {
  const total = ACTIVITIES.length;
  const done = ACTIVITIES.filter((a) => a.kind === 'collect' ? a.done : false).length
    + state.player.racesWon + state.player.deliveries + state.player.rampages
    + state.player.jumps + state.player.fish + state.player.blackjackWins + state.player.aimScore / 10 + state.player.chessWins;
  return { total, done: Math.floor(done) };
}

/** Activities the HUD phone lists with hints, nearest first. */
export function nearbyActivities(state, n = 5) {
  const p = state.player;
  return ACTIVITIES
    .map((a) => ({ a, d: dist2(p.x, p.y, a.x, a.y) }))
    .sort((x, y) => x.d - y.d)
    .slice(0, n)
    .map((x) => x.a);
}

export function blipTargets(state) {
  const out = [];
  const ms = missionState;
  if (ms.active) {
    const step = ms.active.def.steps[ms.active.stepIndex];
    if (step && step.blip) {
      const b = step.blip(state);
      if (b) out.push({ x: b.x, y: b.y, kind: 'mission' });
    }
  } else {
    const def = MISSIONS[ms.nextIndex];
    if (def && spots[def.giver]) out.push({ x: spots[def.giver].x, y: spots[def.giver].y, kind: 'mission' });
  }
  const r = state._race;
  if (r) out.push({ x: r.checkpoints[r.next].x, y: r.checkpoints[r.next].y, kind: 'race' });
  const d = state._delivery;
  if (d) out.push({ x: d.dest.x, y: d.dest.y, kind: 'race' });
  return out;
}
