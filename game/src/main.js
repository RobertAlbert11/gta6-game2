// Neon Coast — game bootstrap, loop, menus, camera, day/night, screenshots hook.

import { initInput, key, pressed, endFrame, mouse, clearMouse, BINDINGS } from './input.js';
import { initAudio, setMusicMode, setRainLevel, sfx, toggleRadio, nextRadioStation, radioName } from './audio.js';
import { World, CITY_W, CITY_H, roadsX, roadsY, T } from './world.js';
import { WORLD, PLAYER, POLICE, WEATHER, clamp, dist2, money$ } from './config.js';
import { makeState, updatePlayer, updatePeds, updateTraffic, updateEnemies, updateBullets, updateParticles, updateDirector, spawnTrafficCar, spawnPed, spawnPoliceCar, exitCar, damagePlayer, puff, addHeat } from './entities.js';
import { draw, updateWeather } from './render.js';
import { Hud } from './hud.js';
import { setMinimapLabel, cycleMinimapZoom } from './minimap.js';
import { initSpots, spots, setupActivities, updateActivities, updateStunts, MISSIONS, missionState, updateMission, activityProgress, ACTIVITIES } from './missions.js';
import { saveGame, loadGame, slotInfo, bindRefs } from './save.js';

const canvas = document.getElementById('view');
const ctx = canvas.getContext('2d');
initInput(canvas);
initAudio();

let world = null, state = null, hud = null;
let worldSeed = 7;
let mode = 'menu'; // menu | play | dead | busted | pause | save | controls
let prevMode = 'play';
let menuSel = 0;
const menuItems = ['btnNew', 'btnLoad', 'btnControls'];

function resize() {
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
}
window.addEventListener('resize', resize);
resize();

// ---------------------------------------------------------------- game lifecycle

function newGame() {
  world = new World(worldSeed);
  state = makeState(world);
  initSpots(world);
  setupActivities(world, state);
  hud = hud ?? new Hud(canvas);
  bindRefs(missionState, ACTIVITIES);
  // dynamic weather kicks off clear; the director rolls dice later
  state.weather = { kind: 'clear', level: 0, timer: 40 + Math.random() * 90 };
  // expansion pass: save system hook to snapshot activity progress
  state._actDoneSnapshot = () => activityProgress(state).done;
  // seed initial traffic and peds near the player
  for (let k = 0; k < 10; k++) {
    const s = world.spawns.cars[Math.floor(Math.random() * world.spawns.cars.length)];
    if (s && dist2(s.x, s.y, state.player.x, state.player.y) < 1400 * 1400) spawnTrafficCar(state, s);
  }
  for (let k = 0; k < 12; k++) {
    const s = world.spawns.peds[Math.floor(Math.random() * world.spawns.peds.length)];
    if (s) spawnPed(state, s.x, s.y);
  }
  mode = 'play';
  window.__nc = { state, world, mode: () => mode }; // debug + screenshot hooks
  hud.show(true);
  hud.bannerBig('VESPERA BAY', 'Welcome to the Neon Coast');
  state.cam.x = state.player.x; state.cam.y = state.player.y;
}

function gameApi() {
  return hud.api(state);
}

// ---------------------------------------------------------------- main loop

let last = performance.now();
function frame(now) {
  const dt = Math.min(0.05, (now - last) / 1000);
  last = now;
  if (mode === 'play') update(dt);
  if (state && mode !== 'menu') render();
  if (mode === 'menu') renderMenuBg();
  endFrame();
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);

function update(dt) {
  state.time += dt;
  // clock: 1 game hour = 45 real seconds
  state.clock += dt / 45;
  if (state.clock >= 24) { state.clock -= 24; state.day++; }

  // pause / phone / save
  if (pressed('KeyP') || pressed('Escape')) openPause();
  if (pressed('KeyM')) { state.phoneOpen = !state.phoneOpen; sfx.ui(); }
  // polish pass: minimap zoom cycle + quick save/load keybinds
  if (pressed(BINDINGS.zoomCycle)) { const z = cycleMinimapZoom(1); sfx.ui(); state._zoomToast = z; }
  if (pressed('F5')) { saveGame(0, state); hud.toast('Quick-saved to slot 1'); sfx.pickup(); }
  if (pressed('F9')) { const ok = loadGame(0, state); hud.toast(ok ? 'Quick-loaded slot 1' : 'Slot 1 is empty'); sfx.ui(); }
  // expansion pass: radio toggle (R) + station flip (Shift+R) while playing
  if (pressed(BINDINGS.radio)) {
    const name = state.player.inCar ? nextRadioStation() : toggleRadio();
    hud.toast(name === 'off' ? 'Radio off' : `Radio: ${name}`);
    sfx.ui();
  }

  // dynamic weather director: roll clear ↔ rain every so often
  const wtx = state.weather;
  if (wtx) {
    wtx.timer -= dt;
    if (wtx.timer <= 0) {
      wtx.timer = WEATHER.changeEvery[0] + Math.random() * (WEATHER.changeEvery[1] - WEATHER.changeEvery[0]);
      const toRain = wtx.kind !== 'rain' && Math.random() < WEATHER.rainChance;
      const toClear = wtx.kind === 'rain' && Math.random() < 0.45;
      if (toRain) { wtx.kind = 'rain'; wtx.level = 0.5 + Math.random() * 0.5; }
      else if (toClear) { wtx.kind = 'clear'; wtx.level = 0; }
    }
  }
  updateWeather(state, dt, state.cam, canvas.width, canvas.height);
  setRainLevel(state.weather?.kind === 'rain' ? (state.weather.level ?? 1) : 0);

  updatePlayer(state, inputApi(), dt);
  updatePeds(state, dt);
  updateTraffic(state, dt);
  updateEnemies(state, dt);
  updateBullets(state, dt);
  updateParticles(state, dt);
  updateDirector(state, dt);
  updateMission(state, gameApi(), dt);
  updateActivities(state, gameApi(), inputApi(), dt);
  updateStunts(state, gameApi(), dt);
  updateDialogAdvance();
  updateMarkers();

  // camera follows with lookahead
  const p = state.player;
  const lookX = p.inCar ? Math.cos(p.inCar.dir) * 90 : 0;
  const lookY = p.inCar ? Math.sin(p.inCar.dir) * 90 : 0;
  state.cam.x += (p.x + lookX - state.cam.x) * Math.min(1, dt * 5);
  state.cam.y += (p.y + lookY - state.cam.y) * Math.min(1, dt * 5);
  state.cam.shake = Math.max(0, state.cam.shake - dt * 30);

  // music mode by time + heat
  const phase = (state.clock >= 6 && state.clock < 19) ? 'day' : 'night';
  setMusicMode(Math.floor(p.wanted) >= 1 ? 'chase' : phase);

  // minimap district label
  const district = world.districtAt ? world.districtAt(p.x, p.y) : null;
  setMinimapLabel(typeof district === 'string' ? district : district?.name ?? '');

  // death / busted
  if (!p.alive) { mode = 'dead'; show('deadPanel', true); }
  if (p.wanted >= 5 && !p.inCar && copTouching(state)) {
    busted();
  }
  hud.update(state, dt);
}

function copTouching(s) {
  for (const e of s.enemies) if (e.kind === 'cop' && e.alive && dist2(e.x, e.y, s.player.x, s.player.y) < 30 * 30) return true;
  for (const c of s.cars) if (c.driver === 'cop' && c.alive && dist2(c.x, c.y, s.player.x, s.player.y) < 40 * 40) return true;
  return false;
}

function busted() {
  const p = state.player;
  p.wanted = 0;
  p.money = Math.max(0, p.money - 300);
  p.ammo = { pistol: 0, smg: 0, shotgun: 0 };
  p.weapon = 0;
  if (p.inCar) exitCar(state, true);
  mode = 'busted';
  show('bustedPanel', true);
}

function inputApi() {
  return {
    key, pressed, mouse,
  };
}

function updateDialogAdvance() {
  if ((pressed('KeyE') || pressed('Enter') || pressed('Space')) && hud.dialogT > 0) hud.dialogAdvance();
}

/** Ground markers: next mission giver, active race/delivery target, services near the player. */
function updateMarkers() {
  const list = [];
  if (missionState.active) {
    const step = missionState.active.def.steps[missionState.active.stepIndex];
    const b = step && step.blip ? step.blip(state) : null;
    if (b) list.push({ x: b.x, y: b.y, color: '#ff2d78', r: 30 });
  } else {
    const def = MISSIONS[missionState.nextIndex];
    if (def && spots[def.giver]) list.push({ x: spots[def.giver].x, y: spots[def.giver].y, color: '#ff2d78', r: 28 });
  }
  const r = state._race;
  if (r) { const cp = r.checkpoints[r.next]; list.push({ x: cp.x, y: cp.y, color: '#0ff', r: 34 }); }
  const d = state._delivery;
  if (d) list.push({ x: d.dest.x, y: d.dest.y, color: '#ffd23f', r: 30 });
  if (list.length < 3) {
    for (const a of ACTIVITIES) {
      if (a.kind === 'collect' || (a.done && a.kind === 'collect')) continue;
      if (dist2(a.x, a.y, state.player.x, state.player.y) < 700 * 700) {
        list.push({ x: a.x, y: a.y, color: '#5fb8a8', r: Math.max(18, a.radius - 8) });
      }
      if (list.length >= 8) break;
    }
  }
  state._markers = list;
}

// ---------------------------------------------------------------- rendering

function render() {
  const w = canvas.width, h = canvas.height;
  const cam = { x: state.cam.x, y: state.cam.y };
  if (state.cam.shake > 0) {
    cam.x += (Math.random() - 0.5) * state.cam.shake;
    cam.y += (Math.random() - 0.5) * state.cam.shake;
  }
  draw(ctx, cam, world, state, w, h);
  drawWorldLabels(ctx, cam, w, h);
}

function drawWorldLabels(g, cam, w, h) {
  // district name under player
  const d = world.districtAt ? world.districtAt(state.player.x, state.player.y) : null;
  if (!d) return;
  g.font = '600 13px system-ui';
  g.textAlign = 'center';
  g.fillStyle = 'rgba(220,240,255,0.75)';
  g.fillText(d.name ?? d, state.player.x, state.player.y - 26);
}

let menuBg = null;
function renderMenuBg() {
  // idle city view behind the menu
  if (!menuBg) {
    menuBg = { world: new World(7), t: 0 };
  }
  menuBg.t += 0.016;
  const fakeState = menuBg.fake ?? (menuBg.fake = makeState(menuBg.world));
  fakeState.clock = 20;
  fakeState.time = menuBg.t * 1000;
  fakeState.cam = { x: CITY_W / 2 + Math.sin(menuBg.t * 0.1) * 400, y: CITY_H / 2 + Math.cos(menuBg.t * 0.07) * 300, shake: 0 };
  draw(ctx, fakeState.cam, menuBg.world, fakeState, canvas.width, canvas.height);
}

// ---------------------------------------------------------------- menus

function show(id, on) {
  document.getElementById(id).classList.toggle('hidden', !on);
}

function hideAll() {
  for (const id of ['menu', 'pausePanel', 'savePanel', 'deadPanel', 'bustedPanel']) show(id, false);
}

function openPause() {
  mode = 'pause';
  const p = state.player;
  document.getElementById('pauseSub').textContent =
    `${p.missionsDone} missions · ${activityProgress(state).done}/${activityProgress(state).total} activities · ${p.kills} kills`;
  document.getElementById('pauseStats').innerHTML =
    `<div class="stat"><span>Missions</span><b>${p.missionsDone}/${MISSIONS.length}</b></div>` +
    `<div class="stat"><span>Packages</span><b>${p.packages}/20</b></div>` +
    `<div class="stat"><span>Races won</span><b>${p.racesWon}</b></div>` +
    `<div class="stat"><span>Deliveries</span><b>${p.deliveries}</b></div>` +
    `<div class="stat"><span>Rampages</span><b>${p.rampages}</b></div>` +
    `<div class="stat"><span>Stunt jumps</span><b>${p.jumps}</b></div>` +
    `<div class="stat"><span>Cars jacked</span><b>${p.jacked}</b></div>` +
    `<div class="stat"><span>Taxi fares</span><b>${p.taxiFares ?? 0}</b></div>` +
    `<div class="stat"><span>Bounties</span><b>${p.bounties ?? 0}</b></div>` +
    `<div class="stat"><span>Money</span><b>${money$(p.money)}</b></div>`;
  show('pausePanel', true);
  sfx.ui();
}

document.getElementById('btnResume').onclick = () => { hideAll(); mode = 'play'; };
document.getElementById('btnQuit').onclick = () => { hideAll(); hud.show(false); mode = 'menu'; };
document.getElementById('btnSave').onclick = () => { saveMode = 'save'; show('pausePanel', false); openSave(); };
let saveMode = 'save';
document.getElementById('btnLoad').onclick = () => { saveMode = 'load'; openSave(); };
document.getElementById('btnControls').onclick = () => {
  alert('WASD move · Shift sprint · F attack · 1-4 weapons · E enter/interact · Space brake/handbrake · H horn · Q headlights · C minimap zoom · R radio · F5 quick-save · F9 quick-load · M activities · P pause');
};
document.getElementById('btnNew').onclick = () => { hideAll(); newGame(); };
document.getElementById('btnRespawn').onclick = () => {
  const p = state.player;
  p.alive = true; p.hp = PLAYER.hp; p.wanted = 0;
  p.x = spots.hospital.x; p.y = spots.hospital.y;
  p.money = Math.max(0, p.money - 100);
  show('deadPanel', false); mode = 'play';
};
document.getElementById('btnBail').onclick = () => {
  show('bustedPanel', false); mode = 'play';
};

function openSave() {
  mode = 'save';
  for (let k = 0; k < 3; k++) {
    const info = slotInfo(k);
    const label = info ? `SLOT ${k + 1} — ${new Date(info.when).toLocaleString()} · ${money$(info.money)} · ${info.missions} missions` : `SLOT ${k + 1} — empty`;
    document.getElementById('sv' + k).textContent = label;
  }
  show('savePanel', true);
  sfx.ui();
}

for (let k = 0; k < 3; k++) {
  document.getElementById('sv' + k).onclick = () => {
    if (saveMode === 'save') {
      saveGame(k, state);
      hud.toast('Saved to slot ' + (k + 1));
    } else {
      if (!state) newGame();
      const ok = loadGame(k, state);
      hud.toast(ok ? 'Loaded slot ' + (k + 1) : 'Slot ' + (k + 1) + ' is empty');
      if (ok) { mode = 'play'; hideAll(); hud.show(true); }
    }
    openSaveRefresh(saveMode);
  };
}
function openSaveRefresh(m) {
  for (let k = 0; k < 3; k++) {
    const info = slotInfo(k);
    const label = info ? `SLOT ${k + 1} — ${new Date(info.when).toLocaleString()} · ${money$(info.money)} · ${info.missions} missions` : `SLOT ${k + 1} — empty`;
    document.getElementById('sv' + k).textContent = label;
  }
  if (m === 'save') { mode = 'play'; show('savePanel', false); }
}
document.getElementById('btnBack').onclick = () => {
  show('savePanel', false);
  if (saveMode === 'load' && state) { mode = 'play'; }
  else { mode = 'menu'; }
};

// ---------------------------------------------------------------- screenshots hook (?shot=)

const q = new URLSearchParams(location.search);
const seedQ = Number(q.get('seed'));
if (Number.isFinite(seedQ) && seedQ > 0) worldSeed = seedQ;
if (q.get('shot')) {
  const which = q.get('shot');
  window.addEventListener('load', () => {
    setTimeout(() => {
      if (which === 'start') {
        // menu stays up
      } else {
        if (!world) newGame();
        hideAll(); // the menu panel starts visible; drop it so play shots see the city
        if (which === 'play') {
          state.clock = 21.5; // neon night
          const car = spawnTrafficCar(state, { x: state.player.x + 60, y: state.player.y, dir: 0 });
          state.player.inCar = car;
        }
        if (which === 'dusk') {
          state.clock = 18.4; // golden-hour tint
          const car = spawnTrafficCar(state, { x: state.player.x - 90, y: state.player.y - 40, dir: 0 });
          car.lights = true;
          state.player.inCar = car;
        }
        if (which === 'chase' || which === 'end') {
          state.clock = 21.8; // night chase under neon + headlights
          state.player.money = 25000;
          for (let k = 0; k < 5; k++) addHeat(state, 1);
          // put the player in a fast car so the heat spawns a real pursuit
          const car = spawnTrafficCar(state, { x: state.player.x + 50, y: state.player.y, dir: 0 });
          state.player.inCar = car;
          car.speed = 200;
          // a couple of cruisers right on the bumper for the shot
          spawnPoliceCar(state, state.player.x, state.player.y);
          spawnPoliceCar(state, state.player.x, state.player.y);
        }
        if (which === 'rain') {
          // storm shot: night rain + headlights for the weather pass
          state.clock = 22.2;
          state.weather = { kind: 'rain', level: 0.9, timer: 999 };
          const car = spawnTrafficCar(state, { x: state.player.x + 60, y: state.player.y, dir: 0 });
          car.lights = true;
          state.player.inCar = car;
          car.speed = 150;
        }
        if (which === 'day') {
          state.clock = 10.5; // bright morning for the city day view
        }
        if (which === 'mission') {
          // expansion pass: mid-mission shot — tracker up, objective marker live, some heat
          state.clock = 20.4;
          state.player.money = 4200;
          startMission(state, MISSIONS[6], hud.api(state)); // Casino Nights, multi-step
          missionState.active.stepIndex = 1; // skip straight to the 'persuade' objective
          state.weather = { kind: 'rain', level: 0.45, timer: 999 };
          const car = spawnTrafficCar(state, { x: state.player.x - 120, y: state.player.y + 40, dir: 0.4 });
          car.lights = true;
        }
        mode = 'play';
      }
      window.__shotReady = true;
    }, 400);
  });
}
