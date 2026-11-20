// Entities: player, pedestrians, vehicles, bullets, particles, police AI, traffic AI.

import { WORLD, PLAYER, CAR, POLICE, WEAPONS, clamp, dist, dist2, angleTo, angleDiff, rng } from './config.js';
import { T, CITY_W, CITY_H, roadsX, roadsY, nearestRoad } from './world.js';
import { sfx } from './audio.js';

const R = rng(20261120);
const SKINS = ['#d9a06b', '#b97a4e', '#8a5a36', '#e8b98a', '#6b4226'];
const SHIRTS = ['#c14b4b', '#4b7bc1', '#c1a54b', '#57a05e', '#888ea8', '#c17ec4', '#d9814b', '#5fb8a8'];
const CAR_COLORS = ['#c14b4b', '#4b7bc1', '#c1a54b', '#57a05e', '#888ea8', '#c17ec4', '#d9814b', '#3fa9d9'];

export function makeState(world) {
  return {
    world,
    time: 0,
    clock: 8,
    day: 1,
    player: {
      x: roadsX[12], y: roadsY[8] + 26, dir: 0, hp: PLAYER.hp, armor: 0, money: 350,
      inCar: null, weapon: 0, ammo: { pistol: 60, smg: 0, shotgun: 0 },
      wanted: 0, heat: 0, alive: true, attackCd: 0, sprintT: 0, stamina: PLAYER.stamina,
      kills: 0, jacked: 0, missionsDone: 0, packages: 0, racesWon: 0, rampages: 0,
      jumps: 0, deliveries: 0, fish: 0, blackjackWins: 0, aimScore: 0, chessWins: 0,
    },
    peds: [], cars: [], enemies: [], bullets: [], particles: [], decals: [], pickups: [],
    cam: { x: 0, y: 0, shake: 0 },
    toasts: [], banner: null, dialog: null, phoneOpen: false,
    spawnTimer: 0, pedTimer: 0, sirenTimer: 0,
    activityFlags: {},
    stats: { distance: 0, earned: 0 },
  };
}

export function phaseName(state) {
  const c = state.clock;
  return (c >= 6 && c < 17) ? 'day' : (c >= 20 || c < 5) ? 'night' : 'dusk';
}

// ---------------------------------------------------------------- spawning

export function spawnPed(state, x, y) {
  const w = state.world;
  if (x === undefined) {
    const s = w.spawns.peds[Math.floor(R() * w.spawns.peds.length)];
    x = s.x; y = s.y;
  }
  state.peds.push({
    x, y, dir: R() * Math.PI * 2, hp: 30, alive: true,
    shirt: SHIRTS[Math.floor(R() * SHIRTS.length)], skin: SKINS[Math.floor(R() * SKINS.length)],
    speed: 26 + R() * 22, state: 'walk', timer: 2 + R() * 4, tx: x, ty: y,
    panic: 0, calling: 0, bob: R() * 10,
  });
}

export function spawnTrafficCar(state, spec) {
  const w = state.world;
  if (!spec) spec = w.spawns.cars[Math.floor(R() * w.spawns.cars.length)];
  const kindRoll = R();
  const vtype = kindRoll < 0.55 ? 'sedan' : kindRoll < 0.75 ? 'van' : kindRoll < 0.93 ? 'sport' : 'taxi';
  const car = {
    x: spec.x, y: spec.y, dir: spec.dir ?? 0, speed: 0,
    vtype, color: vtype === 'taxi' ? '#f7c531' : CAR_COLORS[Math.floor(R() * CAR_COLORS.length)],
    len: vtype === 'van' ? 34 : vtype === 'sport' ? 28 : 30, wid: vtype === 'van' ? 17 : 15,
    hp: CAR.hp, alive: true, driver: 'civ',
    lights: phaseName(state) !== 'day', siren: false, burnt: false,
    target: null, waitT: 0, parked: spec.parked ?? false, road: spec.road ?? null,
  };
  state.cars.push(car);
  return car;
}

export function spawnPoliceCar(state, nearX, nearY) {
  const a = R() * Math.PI * 2;
  const d = 500 + R() * 300;
  const x = clamp(nearX + Math.cos(a) * d, T, CITY_W - T);
  const y = clamp(nearY + Math.sin(a) * d, T, CITY_H - T);
  const car = spawnTrafficCar(state, { x, y, dir: angleTo(x, y, nearX, nearY) });
  car.vtype = 'police'; car.color = '#22337a'; car.driver = 'cop'; car.siren = true;
  car.target = { x: nearX, y: nearY };
  return car;
}

export function spawnCop(state, nearX, nearY) {
  const a = R() * Math.PI * 2;
  const d = 260 + R() * 160;
  const x = clamp(nearX + Math.cos(a) * d, T, CITY_W - T);
  const y = clamp(nearY + Math.sin(a) * d, T, CITY_H - T);
  const cop = {
    kind: 'cop', x, y, dir: 0, hp: 60, alive: true, skin: SKINS[Math.floor(R() * SKINS.length)],
    shirt: '#2a4a9f', speed: POLICE.footSpeed, fireCd: 1 + R(), state: 'chase',
  };
  state.enemies.push(cop);
  return cop;
}

export function spawnGangster(state, x, y) {
  const e = {
    kind: 'gang', x, y, dir: 0, hp: 50, alive: true,
    skin: SKINS[Math.floor(R() * SKINS.length)], shirt: '#7a1f3d',
    speed: 120, fireCd: 1 + R(), state: 'idle',
  };
  state.enemies.push(e);
  return e;
}

export function dropPickup(state, kind, x, y, amount) {
  state.pickups.push({ kind, x, y, amount, alive: true, bob: R() * 10 });
}

// ---------------------------------------------------------------- particles

export function puff(state, x, y, color, n = 6, spread = 40, life = 0.5, r = 3) {
  for (let k = 0; k < n; k++) {
    const a = R() * Math.PI * 2, s = R() * spread;
    state.particles.push({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, life: life * (0.6 + R() * 0.8), max: life, r: r * (0.6 + R() * 0.8), color });
  }
}

export function bloodDecal(state, x, y) {
  state.decals.push({ x, y, r: 5 + R() * 6, kind: 'blood' });
  if (state.decals.length > 140) state.decals.shift();
}

// ---------------------------------------------------------------- damage

export function damagePlayer(state, dmg, src = 'world') {
  const p = state.player;
  if (!p.alive) return;
  let d = dmg;
  if (p.armor > 0) {
    const abs = Math.min(p.armor, d * 0.65);
    p.armor -= abs; d -= abs;
  }
  p.hp -= d;
  state.cam.shake = Math.min(14, state.cam.shake + 3);
  sfx.hurt();
  if (p.hp <= 0) {
    p.hp = 0; p.alive = false;
    bloodDecal(state, p.x, p.y);
    puff(state, p.x, p.y, '#a8162a', 10, 60, 0.8, 3);
  }
}

export function damageCar(state, car, dmg, byPlayer) {
  if (!car.alive) return;
  car.hp -= dmg;
  puff(state, car.x, car.y, '#9aa2b0', 3, 30, 0.3, 2);
  if (car.hp <= 0) {
    car.alive = false; car.burnt = true;
    puff(state, car.x, car.y, '#ff9d3f', 18, 90, 0.9, 5);
    puff(state, car.x, car.y, '#54565c', 12, 50, 1.4, 6);
    state.decals.push({ x: car.x, y: car.y, r: 18, kind: 'scorch' });
    sfx.crash();
    sfx.explosion();
    if (car === state.player.inCar) {
      exitCar(state, true);
      damagePlayer(state, 25, 'explosion');
    }
    // chained explosions: nearby cars catch it
    for (const o of state.cars) {
      if (o.alive && o !== car && dist2(o.x, o.y, car.x, car.y) < 90 * 90) {
        setTimeout(() => o.alive && damageCar(state, o, 55, byPlayer), 250 + R() * 300);
      }
    }
    if (byPlayer) addHeat(state, 1.2);
  }
}

export function damagePed(state, ped, dmg, byPlayer) {
  if (!ped.alive) return;
  ped.hp -= dmg;
  puff(state, ped.x, ped.y, '#a8162a', 4, 30, 0.4, 2);
  ped.panic = 8;
  if (ped.hp <= 0) {
    ped.alive = false;
    bloodDecal(state, ped.x, ped.y);
    if (byPlayer) {
      state.player.kills++;
      addHeat(state, 1);
      if (R() < 0.4) dropPickup(state, 'money', ped.x, ped.y, 20 + Math.floor(R() * 60));
    }
  }
}

export function damageEnemy(state, e, dmg, byPlayer) {
  if (!e.alive) return;
  e.hp -= dmg;
  puff(state, e.x, e.y, '#a8162a', 4, 30, 0.4, 2);
  if (e.hp <= 0) {
    e.alive = false;
    bloodDecal(state, e.x, e.y);
    if (byPlayer) {
      state.player.kills++;
      if (e.kind === 'cop') addHeat(state, 1.5);
      if (R() < 0.5) dropPickup(state, 'money', e.x, e.y, 30 + Math.floor(R() * 70));
      if (e.kind === 'cop' && R() < 0.3) dropPickup(state, 'gun-pistol', e.x, e.y);
    }
  }
}

export function addHeat(state, stars) {
  state.player.wanted = Math.min(5, Math.round((state.player.wanted + stars) * 10) / 10);
  state.player.heat = POLICE.wantedDecay;
  state.sirenTimer = Math.max(state.sirenTimer, 0.6);
}

export function coolHeat(state, dt) {
  const p = state.player;
  if (p.wanted <= 0) return;
  p.heat -= dt;
  if (p.heat <= 0) {
    p.wanted = Math.max(0, Math.floor(p.wanted));
    if (p.wanted > 0) p.heat = POLICE.wantedDecay;
  }
}

// ---------------------------------------------------------------- bullets

export function fireBullet(state, x, y, dir, wdef, byPlayer, owner) {
  const pellets = wdef.pellets ?? 1;
  for (let k = 0; k < pellets; k++) {
    const a = dir + (R() - 0.5) * 2 * (wdef.spread ?? 0);
    state.bullets.push({
      x, y, vx: Math.cos(a) * 620, vy: Math.sin(a) * 620,
      dmg: wdef.dmg, life: wdef.range / 620, byPlayer, owner,
    });
  }
  sfx.shoot(wdef.id);
  puff(state, x + Math.cos(dir) * 8, y + Math.sin(dir) * 8, '#ffe9a8', 2, 20, 0.12, 2);
}

function collideWorld(state, ent, r) {
  const w = state.world;
  for (const b of w.blocks) {
    if (b.kind === 'lot' || b.kind === 'park') continue;
    if (Math.abs(ent.x - b.x) > b.w / 2 + r + 6 || Math.abs(ent.y - b.y) > b.h / 2 + r + 6) continue;
    for (const bd of b.buildings) {
      const cx = clamp(ent.x, bd.x, bd.x + bd.w);
      const cy = clamp(ent.y, bd.y, bd.y + bd.h);
      const dx = ent.x - cx, dy = ent.y - cy;
      const d2 = dx * dx + dy * dy;
      if (d2 < r * r) {
        const d = Math.sqrt(d2) || 0.01;
        ent.x = cx + (dx / d) * r;
        ent.y = cy + (dy / d) * r;
      }
    }
  }
  ent.x = clamp(ent.x, 6, CITY_W - 6);
  ent.y = clamp(ent.y, 6, CITY_H - 6);
}

// ---------------------------------------------------------------- player

function collectPickup(state, pk) {
  const p = state.player;
  pk.alive = false;
  if (pk.kind === 'health') { p.hp = Math.min(PLAYER.hp, p.hp + 50); sfx.pickup(); }
  else if (pk.kind === 'armor') { p.armor = Math.min(PLAYER.maxArmor, p.armor + 50); sfx.pickup(); }
  else if (pk.kind === 'money') { p.money += pk.amount ?? 25; sfx.cash(); }
  else if (pk.kind === 'package') { p.packages++; p.money += 150; sfx.pickup(); }
  else if (pk.kind === 'gun-pistol') { p.ammo.pistol += 24; p.weapon = 2; sfx.pickup(); }
  else if (pk.kind === 'gun-smg') { p.ammo.smg += 40; p.weapon = 3; sfx.pickup(); }
  else if (pk.kind === 'gun-shotgun') { p.ammo.shotgun += 12; p.weapon = 4; sfx.pickup(); }
}

function meleeAttack(state, wdef) {
  const st = state;
  const p = st.player;
  p.attackCd = wdef.rate;
  sfx.punch();
  const rx = p.x + Math.cos(p.dir) * 20, ry = p.y + Math.sin(p.dir) * 20;
  for (const pd of st.peds) {
    if (pd.alive && dist2(rx, ry, pd.x, pd.y) < 26 * 26) damagePed(st, pd, wdef.dmg, true);
  }
  for (const e of st.enemies) {
    if (e.alive && dist2(rx, ry, e.x, e.y) < 26 * 26) damageEnemy(st, e, wdef.dmg, true);
  }
  for (const c of st.cars) {
    if (c.alive && dist2(rx, ry, c.x, c.y) < 30 * 30) damageCar(st, c, wdef.dmg * 0.5, true);
  }
  puff(st, rx, ry, '#ffffff', 2, 15, 0.15, 2);
}

export function updatePlayer(state, input, dt) {
  const p = state.player;
  if (!p.alive) return;
  p.attackCd = Math.max(0, p.attackCd - dt);

  if (p.inCar) drivePlayer(state, input, dt);
  else walkPlayer(state, input, dt);

  for (let k = 1; k <= 4; k++) {
    const w = WEAPONS[k];
    if (!w) continue;
    if (input.pressed('Digit' + k)) {
      if (k <= 1 || (p.ammo[w.id] ?? 0) > 0) { p.weapon = k; sfx.ui(); }
    }
  }
  const wdef = WEAPONS[p.weapon];
  const wantFire = wdef.auto
    ? (input.key('KeyF') || input.mouse().down)
    : (input.pressed('KeyF') || input.mouse().hit);
  if (wantFire && p.attackCd <= 0) {
    if (wdef.id === 'fist' || wdef.id === 'bat') meleeAttack(state, wdef);
    else if ((p.ammo[wdef.id] ?? 0) > 0) {
      p.ammo[wdef.id]--;
      const ox = p.x + Math.cos(p.dir) * 12, oy = p.y + Math.sin(p.dir) * 12;
      fireBullet(state, ox, oy, p.dir, wdef, true, p);
      p.attackCd = wdef.rate;
      state.cam.shake = Math.min(10, state.cam.shake + wdef.kick);
    }
  }
  for (const pk of state.pickups) {
    if (!pk.alive) continue;
    if (dist2(p.x, p.y, pk.x, pk.y) < 20 * 20) collectPickup(state, pk);
  }
  state.pickups = state.pickups.filter((pk) => pk.alive);
}

function walkPlayer(state, input, dt) {
  const p = state.player;
  let mx = 0, my = 0;
  if (input.key('KeyW') || input.key('ArrowUp')) my -= 1;
  if (input.key('KeyS') || input.key('ArrowDown')) my += 1;
  if (input.key('KeyA') || input.key('ArrowLeft')) mx -= 1;
  if (input.key('KeyD') || input.key('ArrowRight')) mx += 1;
  const moving = mx !== 0 || my !== 0;
  let sprint = (input.key('ShiftLeft') || input.key('ShiftRight')) && p.stamina > PLAYER.minSprint;
  if (sprint && moving) p.stamina = Math.max(0, p.stamina - PLAYER.sprintDrain * dt);
  else p.stamina = Math.min(PLAYER.stamina, p.stamina + PLAYER.staminaRegen * dt);
  const spd = sprint ? PLAYER.sprint : PLAYER.walk;
  if (moving) {
    const l = Math.hypot(mx, my);
    p.x += (mx / l) * spd * dt;
    p.y += (my / l) * spd * dt;
    p.dir = Math.atan2(my, mx);
    state.stats.distance += spd * dt;
  }
  collideWorld(state, p, PLAYER.radius);
  tryCarInteract(state, input);
}

function tryCarInteract(state, input) {
  const p = state.player;
  if (!input.pressed('KeyE') && !input.pressed('Enter')) return;
  let best = null, bd = 60 * 60;
  for (const c of state.cars) {
    if (!c.alive || c.driver === 'cop') continue;
    const d = dist2(p.x, p.y, c.x, c.y);
    if (d < bd) { bd = d; best = c; }
  }
  if (best) {
    if (best.driver === 'civ') {
      p.jacked++;
      addHeat(state, best.speed > 30 ? 1 : 0.6);
      puff(state, best.x, best.y, '#cfd6e2', 5, 30, 0.4, 2);
    }
    best.driver = 'player';
    p.inCar = best;
    sfx.ui();
  }
}

export function exitCar(state, forced) {
  const p = state.player;
  const c = p.inCar;
  if (!c) return;
  if (!forced && Math.abs(c.speed) > PLAYER.carExitSpeed) return;
  if (c.driver === 'player') c.driver = 'none';
  p.inCar = null;
  p.x = c.x - Math.sin(c.dir) * 22;
  p.y = c.y + Math.cos(c.dir) * 22;
  collideWorld(state, p, PLAYER.radius);
}

function drivePlayer(state, input, dt) {
  const p = state.player;
  const c = p.inCar;
  if (!c || !c.alive) { p.inCar = null; return; }
  let throttle = 0, steer = 0, handbrake = false;
  if (input.key('KeyW') || input.key('ArrowUp')) throttle += 1;
  if (input.key('KeyS') || input.key('ArrowDown')) throttle -= 1;
  if (input.key('KeyA') || input.key('ArrowLeft')) steer -= 1;
  if (input.key('KeyD') || input.key('ArrowRight')) steer += 1;
  handbrake = input.key('Space') || input.key('ShiftLeft');
  if (input.pressed('KeyE') || input.pressed('Enter')) exitCar(state, false);

  stepCarPhysics(state, c, throttle, steer, handbrake, dt, CAR.maxSpeed);
  p.x = c.x; p.y = c.y; p.dir = c.dir;
  state.stats.distance += Math.abs(c.speed) * dt;
  if (input.pressed('KeyH')) sfx.horn();
  if (input.pressed('KeyQ')) c.lights = !c.lights;
  // engine hum pitched by speed
  sfx.engine(Math.min(1, Math.abs(c.speed) / CAR.maxSpeed));
}

export function stepCarPhysics(state, c, throttle, steer, handbrake, dt, maxSpd) {
  const cls = CAR.classes[c.vtype] ?? { speed: 1, turn: 1 };
  // rain-slick roads: grip drops with weather wetness
  const wet = state.weather?.kind === 'rain' ? (state.weather.level ?? 0) * 0.16 : 0;
  const top = Math.min(maxSpd * cls.speed * (1 - wet * 0.12), maxSpd * 1.3);
  const grip = handbrake ? 0.965 + wet * 0.008 : CAR.grip - wet * 0.05;
  if (throttle > 0) c.speed += CAR.accel * dt * (c.speed < 0 ? 2 : 1);
  else if (throttle < 0) c.speed -= (c.speed > 0 ? CAR.brake : CAR.accel * 0.6) * dt;
  if (handbrake) c.speed -= CAR.brake * 0.7 * dt;
  c.speed = clamp(c.speed, -CAR.maxReverse, top);
  c.speed *= Math.pow(grip, dt * 60);
  if (Math.abs(c.speed) > 4) {
    const turnRate = CAR.turn * cls.turn * (handbrake ? 1.6 : 1) * clamp(Math.abs(c.speed) / 140, 0.25, 1);
    c.dir += steer * turnRate * dt * (c.speed < 0 ? -1 : 1);
    const skidding = handbrake && Math.abs(c.speed) > 120;
    if (skidding) {
      if (R() < 0.5) puff(state, c.x - Math.cos(c.dir) * 14, c.y - Math.sin(c.dir) * 14, '#c9ccd4', 1, 12, 0.4, 2);
      c._skidT = (c._skidT ?? 0) - dt;
      if (c._skidT <= 0) { sfx.skid(); c._skidT = 0.3; }
    }
  }
  const nx = c.x + Math.cos(c.dir) * c.speed * dt;
  const ny = c.y + Math.sin(c.dir) * c.speed * dt;
  // building collision: bounce back
  const probe = { x: nx, y: ny };
  const before = { x: c.x, y: c.y };
  c.x = nx; c.y = ny;
  collideCarBuildings(state, c);
  if (Math.abs(c.x - nx) > 0.5 || Math.abs(c.y - ny) > 0.5) {
    const impact = Math.abs(c.speed);
    if (impact > 120) {
      damageCar(state, c, impact * 0.08, c.driver === 'player');
      if (c.driver === 'player') state.cam.shake = Math.min(12, state.cam.shake + impact * 0.02);
    }
    c.speed *= -0.3;
    c.x = before.x; c.y = before.y;
  }
  // car-vs-car
  for (const o of state.cars) {
    if (o === c || !o.alive) continue;
    const d2v = dist2(c.x, c.y, o.x, o.y);
    const rr = (c.len + o.len) / 2.4;
    if (d2v < rr * rr && d2v > 0.01) {
      const d = Math.sqrt(d2v);
      const push = (rr - d) / 2;
      const ux = (c.x - o.x) / d, uy = (c.y - o.y) / d;
      c.x += ux * push; c.y += uy * push;
      o.x -= ux * push; o.y -= uy * push;
      const rel = Math.abs(c.speed - o.speed);
      if (rel > 150) {
        damageCar(state, c, rel * 0.04, c.driver === 'player');
        damageCar(state, o, rel * 0.05, c.driver === 'player');
        if (c.driver === 'player' || o.driver === 'player') {
          sfx.crash();
          if (c.driver === 'player') addHeat(state, 0.25);
        }
      }
      c.speed *= 0.7; o.speed = o.speed * 0.6 + c.speed * 0.1;
    }
  }
  // run over peds
  if (Math.abs(c.speed) > 60) {
    for (const pd of state.peds) {
      if (pd.alive && dist2(c.x, c.y, pd.x, pd.y) < 20 * 20) {
        damagePed(state, pd, Math.abs(c.speed) * 0.4, c.driver === 'player');
        if (c.driver === 'player') { sfx.punch(); state.cam.shake = 6; }
      }
    }
  }
}

function collideCarBuildings(state, c) {
  const w = state.world;
  for (const b of w.blocks) {
    if (b.kind === 'lot' || b.kind === 'park') continue;
    if (Math.abs(c.x - b.x) > b.w / 2 + 26 || Math.abs(c.y - b.y) > b.h / 2 + 26) continue;
    for (const bd of b.buildings) {
      const hw = bd.w / 2 + c.wid / 2 - 2, hh = bd.h / 2 + c.len / 2 - 2;
      const cx = bd.x + bd.w / 2, cy = bd.y + bd.h / 2;
      const dx = c.x - cx, dy = c.y - cy;
      if (Math.abs(dx) < hw && Math.abs(dy) < hh) {
        const ox = hw - Math.abs(dx), oy = hh - Math.abs(dy);
        if (ox < oy) c.x = cx + Math.sign(dx) * hw;
        else c.y = cy + Math.sign(dy) * hh;
      }
    }
  }
  c.x = clamp(c.x, T / 2, CITY_W - T / 2);
  c.y = clamp(c.y, T / 2, CITY_H - T / 2);
}

// ---------------------------------------------------------------- ped AI

export function updatePeds(state, dt) {
  const p = state.player;
  for (const pd of state.peds) {
    if (!pd.alive) continue;
    pd.timer -= dt;
    if (pd.panic > 0) pd.panic -= dt;
    const nearPlayer = dist2(pd.x, pd.y, p.x, p.y) < 200 * 200;
    if (nearPlayer && p.wanted >= 1) pd.panic = Math.max(pd.panic, 3);
    if (pd.panic > 0) {
      pd.state = 'flee';
      const away = angleTo(p.x, p.y, pd.x, pd.y);
      pd.dir = away + Math.sin(state.time * 3 + pd.bob) * 0.4;
      pd.x += Math.cos(pd.dir) * 95 * dt;
      pd.y += Math.sin(pd.dir) * 95 * dt;
      if (pd.calling <= 0 && p.wanted >= 1 && R() < 0.004) {
        pd.calling = 20;
        addHeat(state, 0.5);
      }
      pd.calling -= dt;
    } else if (pd.state === 'flee') {
      pd.state = 'walk'; pd.timer = 1 + R() * 3;
    } else if (pd.timer <= 0) {
      pd.state = R() < 0.75 ? 'walk' : 'idle';
      if (pd.state === 'walk') {
        const a = R() * Math.PI * 2, d = 60 + R() * 120;
        pd.tx = pd.x + Math.cos(a) * d;
        pd.ty = pd.y + Math.sin(a) * d;
      }
      pd.timer = 3 + R() * 5;
    }
    if (pd.state === 'walk') {
      const a = angleTo(pd.x, pd.y, pd.tx, pd.ty);
      pd.dir = a;
      pd.x += Math.cos(a) * pd.speed * dt;
      pd.y += Math.sin(a) * pd.speed * dt;
      if (dist2(pd.x, pd.y, pd.tx, pd.ty) < 100) pd.timer = 0;
    }
    collideWorld(state, pd, 6);
  }
  state.peds = state.peds.filter((pd) => pd.alive);
}

// ---------------------------------------------------------------- traffic AI

function trafficSteer(state, c, dt) {
  const axis = Math.abs(Math.cos(c.dir)) > Math.abs(Math.sin(c.dir)) ? 'h' : 'v';
  let aheadX = c.x + Math.cos(c.dir) * 60;
  let aheadY = c.y + Math.sin(c.dir) * 60;
  const road = nearestRoad(aheadX, aheadY);
  if (axis === 'h') aheadY = c.y + (road.y - c.y) * 0.06;
  else aheadX = c.x + (road.x - c.x) * 0.06;
  const desired = angleTo(c.x, c.y, aheadX, aheadY);
  c.dir += clamp(angleDiff(c.dir, desired), -1.4 * dt, 1.4 * dt);
  let wantSpeed = 130 + (c.vtype === 'sport' ? 60 : 0);
  for (const li of state.world.roadLights) {
    if (Math.abs(li.x - c.x) < 70 && Math.abs(li.y - c.y) < 70) {
      const goingV = Math.abs(Math.sin(c.dir)) > 0.7;
      const greenForV = (li.phase + Math.floor(state.clock * 2)) % 2 === 0;
      if (goingV !== greenForV) {
        const along = goingV ? Math.abs(li.y - c.y) : Math.abs(li.x - c.x);
        if (along < 46) wantSpeed = 0;
      }
    }
  }
  for (const o of state.cars) {
    if (o === c || !o.alive) continue;
    if (dist2(c.x, c.y, o.x, o.y) < 80 * 80) {
      const a = angleTo(c.x, c.y, o.x, o.y);
      if (Math.abs(angleDiff(c.dir, a)) < 0.8) wantSpeed = Math.min(wantSpeed, o.speed * 0.8);
    }
  }
  const pl = state.player;
  if (!pl.inCar && dist2(c.x, c.y, pl.x, pl.y) < 70 * 70) wantSpeed = 0;
  if (c.speed < wantSpeed) c.speed = Math.min(wantSpeed, c.speed + 140 * dt);
  else c.speed = Math.max(wantSpeed, c.speed - 260 * dt);
}

export function updateTraffic(state, dt) {
  for (const c of state.cars) {
    if (!c.alive) continue;
    if (c.driver === 'civ' && !c.parked) trafficSteer(state, c, dt);
    else if (c.driver === 'cop') policeCarAI(state, c, dt);
    else if (c.driver === 'none' || c.parked) c.speed *= Math.pow(0.9, dt * 60);
    c.x += Math.cos(c.dir) * c.speed * dt;
    c.y += Math.sin(c.dir) * c.speed * dt;
    if (c.hp < 40 && c.alive) {
      c.smokeT = (c.smokeT ?? 0) - dt;
      if (c.smokeT <= 0) { puff(state, c.x, c.y, '#6a6f78', 1, 10, 0.8, 3); c.smokeT = 0.12; }
    }
    if (c.driver === 'civ' && dist2(c.x, c.y, state.player.x, state.player.y) > 2200 * 2200) c.alive = false;
  }
  state.cars = state.cars.filter((c) => c.alive || c === state.player.inCar);
}

function policeCarAI(state, c, dt) {
  const p = state.player;
  c.siren = true;
  const tx = p.inCar ? p.inCar.x : p.x;
  const ty = p.inCar ? p.inCar.y : p.y;
  const desired = angleTo(c.x, c.y, tx, ty);
  c.dir += clamp(angleDiff(c.dir, desired), -2.2 * dt, 2.2 * dt);
  const d = Math.sqrt(dist2(c.x, c.y, tx, ty));
  let want = d > 90 ? POLICE.chaseSpeed : 60;
  if (p.wanted >= 4 && d < 400) want = POLICE.chaseSpeed + 40;
  if (c.speed < want) c.speed = Math.min(want, c.speed + 220 * dt);
  else c.speed = Math.max(want, c.speed - 300 * dt);
  // ram damage scales with the wanted level (escalation ladder)
  const star = clamp(Math.floor(p.wanted), 0, POLICE.ramDamage.length - 1);
  if (d < 60 && p.inCar && Math.abs(c.speed) > 150) damageCar(state, p.inCar, POLICE.ramDamage[star], false);
  if (p.wanted >= 3 && d < POLICE.fireRange) {
    c.fireCd = (c.fireCd ?? 1) - dt;
    if (c.fireCd <= 0) {
      const esc = POLICE.escalation[Math.min(Math.floor(p.wanted), POLICE.escalation.length - 1)];
      c.fireCd = esc.fireDelay + R() * 0.5;
      const aim = desired + (R() - 0.5) * 0.15;
      fireBullet(state, c.x + Math.cos(aim) * 20, c.y + Math.sin(aim) * 20, aim, WEAPONS[2], false, c);
    }
  }
}

// ---------------------------------------------------------------- cop + gang AI

export function updateEnemies(state, dt) {
  const p = state.player;
  for (const e of state.enemies) {
    if (!e.alive) continue;
    const tx = p.inCar ? p.inCar.x : p.x;
    const ty = p.inCar ? p.inCar.y : p.y;
    const d = Math.sqrt(dist2(e.x, e.y, tx, ty));
    if (e.kind === 'cop') {
      e.dir = angleTo(e.x, e.y, tx, ty);
      if (d > 160) {
        e.x += Math.cos(e.dir) * e.speed * dt;
        e.y += Math.sin(e.dir) * e.speed * dt;
      }
      e.fireCd -= dt;
      if (d < POLICE.fireRange && e.fireCd <= 0) {
        e.fireCd = Math.max(0.4, 0.9 + R() * 0.7 - p.wanted * 0.08);
        const aim = e.dir + (R() - 0.5) * 0.2;
        fireBullet(state, e.x + Math.cos(aim) * 12, e.y + Math.sin(aim) * 12, aim, WEAPONS[2], false, e);
      }
    } else {
      if (e.state === 'idle') {
        e.timer = (e.timer ?? 0) - dt;
        if (e.timer <= 0) { e.timer = 2 + R() * 3; e.dir = R() * Math.PI * 2; }
        if (dist2(e.x, e.y, p.x, p.y) < 200 * 200 && (p.weapon > 0 || p.wanted > 0)) e.state = 'attack';
      } else {
        e.dir = angleTo(e.x, e.y, tx, ty);
        if (d > 140) {
          e.x += Math.cos(e.dir) * e.speed * dt;
          e.y += Math.sin(e.dir) * e.speed * dt;
        }
        e.fireCd -= dt;
        if (e.fireCd <= 0 && d < 300) {
          e.fireCd = 0.8 + R() * 0.6;
          const aim = e.dir + (R() - 0.5) * 0.18;
          fireBullet(state, e.x + Math.cos(aim) * 12, e.y + Math.sin(aim) * 12, aim, WEAPONS[2], false, e);
        }
      }
    }
    collideWorld(state, e, 6);
  }
  state.enemies = state.enemies.filter((e) => e.alive);
}

// ---------------------------------------------------------------- bullets + particles

export function updateBullets(state, dt) {
  const p = state.player;
  for (const b of state.bullets) {
    if (b.life <= 0) continue;
    b.life -= dt;
    const nx = b.x + b.vx * dt, ny = b.y + b.vy * dt;
    let hitWall = false;
    for (const bl of state.world.blocks) {
      if (bl.kind !== 'building') continue;
      if (Math.abs(nx - bl.x) < bl.w / 2 + 40 && Math.abs(ny - bl.y) < bl.h / 2 + 40) {
        for (const bd of bl.buildings) {
          if (nx > bd.x && nx < bd.x + bd.w && ny > bd.y && ny < bd.y + bd.h) { hitWall = true; break; }
        }
        if (hitWall) break;
      }
    }
    if (hitWall) {
      b.life = 0;
      puff(state, nx, ny, '#c9b26a', 3, 25, 0.25, 2);
      continue;
    }
    b.x = nx; b.y = ny;
    if (b.byPlayer) {
      for (const pd of state.peds) {
        if (pd.alive && dist2(b.x, b.y, pd.x, pd.y) < 10 * 10) { damagePed(state, pd, b.dmg, true); b.life = 0; }
      }
      for (const e of state.enemies) {
        if (e.alive && dist2(b.x, b.y, e.x, e.y) < 10 * 10) { damageEnemy(state, e, b.dmg, true); b.life = 0; }
      }
      for (const c of state.cars) {
        if (c.alive && c !== p.inCar && dist2(b.x, b.y, c.x, c.y) < 16 * 16) { damageCar(state, c, b.dmg * 0.6, true); b.life = 0; }
      }
    } else if (p.inCar) {
      if (dist2(b.x, b.y, p.inCar.x, p.inCar.y) < 18 * 18) { damageCar(state, p.inCar, b.dmg * 0.5, false); b.life = 0; }
    } else if (p.alive && dist2(b.x, b.y, p.x, p.y) < 9 * 9) {
      damagePlayer(state, b.dmg, 'gun');
      b.life = 0;
    }
  }
  state.bullets = state.bullets.filter((b) => b.life > 0);
}

export function updateParticles(state, dt) {
  for (const pt of state.particles) {
    pt.life -= dt;
    pt.x += pt.vx * dt;
    pt.y += pt.vy * dt;
    pt.vx *= 0.94; pt.vy *= 0.94;
  }
  state.particles = state.particles.filter((pt) => pt.life > 0);
  if (state.particles.length > 400) state.particles.splice(0, state.particles.length - 400);
}

// ---------------------------------------------------------------- director: spawning + police response

function seenByCop(state) {
  const p = state.player;
  for (const c of state.cars) {
    if (c.driver === 'cop' && c.alive && dist2(c.x, c.y, p.x, p.y) < 400 * 400) return true;
  }
  for (const e of state.enemies) {
    if (e.kind === 'cop' && e.alive && dist2(e.x, e.y, p.x, p.y) < 300 * 300) return true;
  }
  return false;
}

export function updateDirector(state, dt) {
  const p = state.player;
  state.spawnTimer -= dt;
  state.pedTimer -= dt;
  state.sirenTimer -= dt;
  const px = p.x, py = p.y;

  if (state.spawnTimer <= 0) {
    state.spawnTimer = 0.5;
    const near = state.cars.filter((c) => c.driver === 'civ' && dist2(c.x, c.y, px, py) < 1600 * 1600).length;
    if (near < 14) {
      const w = state.world;
      for (let tries = 0; tries < 8; tries++) {
        const s = w.spawns.cars[Math.floor(R() * w.spawns.cars.length)];
        const d2v = dist2(s.x, s.y, px, py);
        if (d2v > 700 * 700 && d2v < 1800 * 1800 && !s.parked) { spawnTrafficCar(state, s); break; }
      }
    }
  }
  if (state.pedTimer <= 0) {
    state.pedTimer = 0.4;
    const near = state.peds.filter((pd) => dist2(pd.x, pd.y, px, py) < 900 * 900).length;
    if (near < 18) {
      const w = state.world;
      for (let tries = 0; tries < 8; tries++) {
        const s = w.spawns.peds[Math.floor(R() * w.spawns.peds.length)];
        const d2v = dist2(s.x, s.y, px, py);
        if (d2v > 400 * 400 && d2v < 1000 * 1000) { spawnPed(state, s.x, s.y); break; }
      }
    }
  }
  const wanted = Math.floor(p.wanted);
  state.copBudget = (state.copBudget ?? 0) - dt;
  if (wanted >= 1 && state.copBudget <= 0) {
    // escalation ladder from config: more stars, faster response, bigger force
    const esc = POLICE.escalation[Math.min(wanted, POLICE.escalation.length - 1)];
    state.copBudget = esc.carBudget;
    const cars = state.cars.filter((c) => c.driver === 'cop' && c.alive).length;
    const cops = state.enemies.filter((e) => e.kind === 'cop' && e.alive).length;
    if (cars < esc.copCars) spawnPoliceCar(state, px, py);
    if (cops < esc.cops) spawnCop(state, px, py);
  }
  if (wanted >= 1 && state.sirenTimer <= 0) {
    sfx.siren();
    state.sirenTimer = 1.6;
  }
  if (!seenByCop(state)) coolHeat(state, dt * 1.4);
  else p.heat = Math.max(p.heat, 1.5);
  // 5-star apex heat: a wanted-star ping on the minimap budget — sirens everywhere
  if (wanted >= 5 && !state._apexPing) {
    state._apexPing = true;
    sfx.starUp();
  } else if (wanted < 5) state._apexPing = false;
}
