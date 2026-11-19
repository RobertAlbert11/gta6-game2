// Rendering: top-down canvas painter for the city, actors, night lights, weather.

import { WORLD, COLORS } from './config.js';
import { T, CITY_W, CITY_H, roadsX, roadsY } from './world.js';

const ROWS = WORLD.rows;

function mix(c1, c2, t) {
  const p = (c) => [parseInt(c.slice(1, 3), 16), parseInt(c.slice(3, 5), 16), parseInt(c.slice(5, 7), 16)];
  const a = p(c1), b = p(c2);
  return `rgb(${Math.round(a[0] + (b[0] - a[0]) * t)},${Math.round(a[1] + (b[1] - a[1]) * t)},${Math.round(a[2] + (b[2] - a[2]) * t)})`;
}

/** #rrggbb + alpha -> rgba() string. */
function hexA(hex, a) {
  const n = parseInt(hex.slice(1), 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`;
}

export function skyPhase(clock) {
  if (clock >= 6 && clock < 17) return { t: 0, name: 'day' };
  if (clock >= 17 && clock < 20) return { t: (clock - 17) / 3, name: 'dusk' };
  if (clock >= 20 || clock < 5) return { t: 1, name: 'night' };
  return { t: Math.max(0, 1 - (clock - 5)), name: 'dawn' };
}

export function palette(clock) {
  const ph = skyPhase(clock);
  const pick = (a, b, c) => (ph.t < 0.5 ? mix(a, b, ph.t * 2) : mix(b, c, ph.t * 2 - 1));
  const d = COLORS.day, k = COLORS.dusk, n = COLORS.night;
  return {
    sky1: pick(d.sky1, k.sky1, n.sky1),
    sky2: pick(d.sky2, k.sky2, n.sky2),
    ground: pick(d.ground, k.ground, n.ground),
    road: pick(d.road, k.road, n.road),
    side: pick(d.side, k.side, n.side),
    dark: ph.t,
    name: ph.name,
  };
}

function off(x, y, cam, w, h) {
  return Math.abs(x - cam.x) > w / 2 + 140 || Math.abs(y - cam.y) > h / 2 + 140;
}

export function draw(ctx, cam, world, state, w, h) {
  const pal = palette(state.clock);
  const night = pal.dark;
  const g = ctx.createLinearGradient(0, 0, 0, h);
  g.addColorStop(0, pal.sky1); g.addColorStop(1, pal.sky2);
  ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);

  ctx.save();
  ctx.translate(w / 2 - cam.x, h / 2 - cam.y);

  drawGround(ctx, pal);
  drawRoads(ctx, cam, pal, w, h);
  drawBeach(ctx, world, pal);
  drawBlocks(ctx, world, pal, cam, w, h);
  drawActors(ctx, state, pal, cam, w, h);

  ctx.restore();

  if (night > 0.05) {
    ctx.fillStyle = `rgba(4,6,18,${night * 0.5})`;
    ctx.fillRect(0, 0, w, h);
    ctx.save();
    ctx.translate(w / 2 - cam.x, h / 2 - cam.y);
    ctx.globalCompositeOperation = 'lighter';
    for (const l of world.lamps) {
      if (off(l.x, l.y, cam, w, h)) continue;
      const rg = ctx.createRadialGradient(l.x, l.y, 0, l.x, l.y, 90);
      rg.addColorStop(0, 'rgba(255,220,140,0.45)'); rg.addColorStop(1, 'rgba(255,220,140,0)');
      ctx.fillStyle = rg; ctx.fillRect(l.x - 90, l.y - 90, 180, 180);
    }
    for (const n of world.neons) {
      if (off(n.x, n.y, cam, w, h)) continue;
      const rg = ctx.createRadialGradient(n.x, n.y, 0, n.x, n.y, 70);
      rg.addColorStop(0, hexA(n.color, 0.73)); rg.addColorStop(1, hexA(n.color, 0));
      ctx.fillStyle = rg; ctx.fillRect(n.x - 70, n.y - 70, 140, 140);
    }
    for (const c of state.cars) {
      if (c.alive && c.lights && !off(c.x, c.y, cam, w, h)) drawHeadlights(ctx, c);
    }
    if (state.player.car && state.player.car.lights) drawHeadlights(ctx, state.player.car);
    ctx.globalCompositeOperation = 'source-over';
    ctx.restore();
  }
}

function drawGround(ctx, pal) {
  ctx.fillStyle = pal.ground;
  ctx.fillRect(-400, -400, CITY_W + 800, CITY_H + 800);
}

function drawRoads(ctx, cam, pal, w, h) {
  const x0 = cam.x - w / 2 - T, x1 = cam.x + w / 2 + T;
  const y0 = cam.y - h / 2 - T, y1 = cam.y + h / 2 + T;
  ctx.fillStyle = pal.road;
  for (const rx of roadsX) if (rx > x0 && rx < x1) ctx.fillRect(rx - T / 2, 0, T, CITY_H);
  for (const ry of roadsY) if (ry > y0 && ry < y1) ctx.fillRect(0, ry - T / 2, CITY_W, T);
  ctx.strokeStyle = 'rgba(255,255,220,0.3)';
  ctx.lineWidth = 2;
  ctx.setLineDash([10, 14]);
  ctx.beginPath();
  for (const rx of roadsX) if (rx > x0 && rx < x1) { ctx.moveTo(rx, Math.max(0, y0)); ctx.lineTo(rx, Math.min(CITY_H, y1)); }
  for (const ry of roadsY) if (ry > y0 && ry < y1) { ctx.moveTo(Math.max(0, x0), ry); ctx.lineTo(Math.min(CITY_W, x1), ry); }
  ctx.stroke();
  ctx.setLineDash([]);
  ctx.strokeStyle = pal.side; ctx.lineWidth = 3;
  ctx.beginPath();
  for (const rx of roadsX) if (rx > x0 && rx < x1) {
    ctx.moveTo(rx - T / 2 + 4, Math.max(0, y0)); ctx.lineTo(rx - T / 2 + 4, Math.min(CITY_H, y1));
    ctx.moveTo(rx + T / 2 - 4, Math.max(0, y0)); ctx.lineTo(rx + T / 2 - 4, Math.min(CITY_H, y1));
  }
  for (const ry of roadsY) if (ry > y0 && ry < y1) {
    ctx.moveTo(Math.max(0, x0), ry - T / 2 + 4); ctx.lineTo(Math.min(CITY_W, x1), ry - T / 2 + 4);
    ctx.moveTo(Math.max(0, x0), ry + T / 2 - 4); ctx.lineTo(Math.min(CITY_W, x1), ry + T / 2 - 4);
  }
  ctx.stroke();
}

function drawBeach(ctx, world, pal) {
  const y0 = roadsY[ROWS - WORLD.beachRows];
  ctx.fillStyle = '#8a6f4d';
  ctx.fillRect(0, y0 + T / 2, CITY_W, 18);
  ctx.fillStyle = pal.dark > 0.5 ? '#1d3a55' : '#3fa9d9';
  ctx.fillRect(0, y0 + T / 2 + 18, CITY_W, CITY_H - y0);
  ctx.strokeStyle = 'rgba(255,255,255,0.45)';
  ctx.lineWidth = 3;
  for (let k = 0; k < 3; k++) {
    const yy = y0 + T / 2 + 46 + k * 30 + Math.sin((world.time ?? 0) * 0.0012 + k * 2) * 5;
    ctx.beginPath(); ctx.moveTo(0, yy); ctx.lineTo(CITY_W, yy); ctx.stroke();
  }
}

function drawBlocks(ctx, world, pal, cam, w, h) {
  for (const b of world.blocks) {
    if (off(b.x, b.y, cam, w, h)) continue;
    if (b.kind === 'park') {
      ctx.fillStyle = pal.dark > 0.5 ? '#122015' : '#274a2c';
      ctx.fillRect(b.x - b.w / 2, b.y - b.h / 2, b.w, b.h);
    } else if (b.kind === 'lot') {
      ctx.fillStyle = '#2c2f36';
      ctx.fillRect(b.x - b.w / 2, b.y - b.h / 2, b.w, b.h);
      ctx.strokeStyle = 'rgba(255,255,255,0.15)';
      ctx.strokeRect(b.x - b.w / 2 + 8, b.y - b.h / 2 + 8, b.w - 16, b.h - 16);
    }
    for (const bd of b.buildings) {
      ctx.fillStyle = shade(bd.hue, pal);
      ctx.fillRect(bd.x, bd.y, bd.w, bd.h);
      ctx.fillStyle = 'rgba(255,255,255,0.05)';
      ctx.fillRect(bd.x, bd.y, bd.w, 4);
      const step = 12;
      for (let wy = bd.y + 8; wy < bd.y + bd.h - 6; wy += step) {
        for (let wx = bd.x + 6; wx < bd.x + bd.w - 6; wx += step) {
          const s = Math.sin(wx * 12.9898 + wy * 78.233 + bd.winSeed) * 43758.5453;
          const f = s - Math.floor(s);
          if (f < 0.3) continue;
          ctx.fillStyle = pal.dark > 0.45 ? (f > 0.75 ? '#ffe9a8' : '#e8c96a') : 'rgba(140,180,220,0.3)';
          ctx.fillRect(wx, wy, 5, 6);
        }
      }
      ctx.strokeStyle = 'rgba(0,0,0,0.4)'; ctx.lineWidth = 1;
      ctx.strokeRect(bd.x, bd.y, bd.w, bd.h);
    }
  }
  for (const p of world.palms) {
    if (off(p.x, p.y, cam, w, h)) continue;
    ctx.fillStyle = '#3a2b1d'; ctx.fillRect(p.x - 2, p.y - 2, 4, 4);
    ctx.fillStyle = pal.dark > 0.5 ? '#1d3a22' : '#3f7a46';
    ctx.beginPath(); ctx.arc(p.x, p.y, p.park ? 9 : 11, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = pal.dark > 0.5 ? '#264a2e' : '#57a05e';
    ctx.beginPath(); ctx.arc(p.x - 3, p.y - 3, p.park ? 5 : 7, 0, Math.PI * 2); ctx.fill();
  }
  ctx.font = 'bold 11px monospace';
  ctx.textAlign = 'center';
  for (const n of world.neons) {
    if (off(n.x, n.y, cam, w, h)) continue;
    ctx.fillStyle = n.color;
    ctx.fillText(n.text, n.x, n.y + 13);
  }
  // landmark labels
  ctx.font = '600 12px system-ui';
  ctx.fillStyle = pal.dark > 0.5 ? 'rgba(180,210,240,0.75)' : 'rgba(30,50,70,0.8)';
  for (const lm of world.landmarks ?? []) {
    if (off(lm.x, lm.y, cam, w, h)) continue;
    ctx.fillText(lm.name, lm.x, lm.y - 18);
  }
  for (const l of world.lamps) {
    if (off(l.x, l.y, cam, w, h)) continue;
    ctx.fillStyle = '#556'; ctx.fillRect(l.x - 1, l.y - 6, 2, 8);
    ctx.fillStyle = '#ffd23f'; ctx.fillRect(l.x - 2, l.y - 8, 4, 3);
  }
}

const HUES = ['#6b5a4a', '#5a6470', '#6a5a6e', '#4a6a5e', '#70604a', '#54586a'];
function shade(hue, pal) {
  const base = HUES[Math.floor(hue * HUES.length) % HUES.length];
  return pal.dark <= 0 ? base : mix(base, '#101623', pal.dark * 0.55);
}

/** Pulsing ground circles for the next mission giver / race start / services near the player. */
function drawMarkers(ctx, state, cam, w, h) {
  const pulse = 0.55 + Math.sin(performance.now() / 300) * 0.25;
  const drawOne = (x, y, color, r = 26) => {
    if (off(x, y, cam, w, h)) return;
    ctx.strokeStyle = color;
    ctx.globalAlpha = pulse;
    ctx.lineWidth = 3;
    ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.stroke();
    ctx.globalAlpha = pulse * 0.35;
    ctx.fillStyle = color;
    ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill();
    ctx.globalAlpha = 1;
  };
  const ms = state._markers;
  if (ms) for (const m of ms) drawOne(m.x, m.y, m.color, m.r);
}

function drawHeadlights(ctx, c) {
  const fx = Math.cos(c.dir), fy = Math.sin(c.dir);
  const lx = c.x + fx * 30, ly = c.y + fy * 30;
  const a0 = Math.atan2(-fy, -fx);
  const rg = ctx.createRadialGradient(lx, ly, 0, lx, ly, 90);
  rg.addColorStop(0, 'rgba(255,245,200,0.32)'); rg.addColorStop(1, 'rgba(255,245,200,0)');
  ctx.fillStyle = rg;
  ctx.beginPath();
  ctx.moveTo(c.x + fx * 14, c.y + fy * 14);
  ctx.arc(lx, ly, 90, a0 - 0.55, a0 + 0.55);
  ctx.closePath(); ctx.fill();
  const bx = c.x - fx * 16, by = c.y - fy * 16;
  ctx.fillStyle = 'rgba(255,60,60,0.85)';
  ctx.fillRect(bx - 9 + fy * 6, by - 9 - fx * 6, 3, 3);
  ctx.fillRect(bx - 9 - fy * 6, by - 9 + fx * 6, 3, 3);
}

// ---------------------------------------------------------------- actors

function drawActors(ctx, state, pal, cam, w, h) {
  // mission/activity markers on the ground, under everything alive
  drawMarkers(ctx, state, cam, w, h);
  for (const d of state.decals) {
    if (off(d.x, d.y, cam, w, h)) continue;
    ctx.fillStyle = d.kind === 'blood' ? 'rgba(120,10,20,0.55)' : 'rgba(25,25,28,0.5)';
    ctx.beginPath(); ctx.arc(d.x, d.y, d.r, 0, Math.PI * 2); ctx.fill();
  }
  for (const p of state.pickups) {
    if (!p.alive || off(p.x, p.y, cam, w, h)) continue;
    drawPickup(ctx, p);
  }
  for (const c of state.cars) {
    if (!c.alive || off(c.x, c.y, cam, w, h)) continue;
    drawCar(ctx, c, pal.dark);
  }
  for (const p of state.peds) {
    if (!p.alive || off(p.x, p.y, cam, w, h)) continue;
    drawPerson(ctx, p.x, p.y, p.dir, p.shirt, p.skin, 0);
  }
  for (const e of state.enemies) {
    if (!e.alive || off(e.x, e.y, cam, w, h)) continue;
    const cop = e.kind === 'cop';
    drawPerson(ctx, e.x, e.y, e.dir, cop ? '#2a4a9f' : e.shirt, e.skin, cop ? 1 : 0, cop ? '#0f1c3f' : '#20242b');
  }
  const pl = state.player;
  if (!pl.inCar) drawPerson(ctx, pl.x, pl.y, pl.dir, '#e8e8f0', '#d9a06b', 2, '#1a1e28');
  ctx.fillStyle = '#ffe9a8';
  for (const b of state.bullets) {
    if (off(b.x, b.y, cam, w, h)) continue;
    ctx.fillRect(b.x - 2, b.y - 2, 4, 4);
  }
  for (const p of state.particles) {
    if (off(p.x, p.y, cam, w, h)) continue;
    ctx.globalAlpha = Math.max(0, p.life / p.max);
    ctx.fillStyle = p.color;
    ctx.fillRect(p.x - p.r, p.y - p.r, p.r * 2, p.r * 2);
  }
  ctx.globalAlpha = 1;
}

function drawPickup(ctx, p) {
  const bob = Math.sin(performance.now() / 250 + p.bob) * 2;
  const y = p.y + bob;
  if (p.kind === 'health') {
    ctx.fillStyle = '#ff5f7a';
    ctx.fillRect(p.x - 6, y - 2, 12, 4); ctx.fillRect(p.x - 2, y - 6, 4, 12);
  } else if (p.kind === 'armor') {
    ctx.fillStyle = '#6fd3ff';
    ctx.beginPath();
    ctx.moveTo(p.x, y - 7); ctx.lineTo(p.x + 6, y - 3); ctx.lineTo(p.x + 4, y + 6);
    ctx.lineTo(p.x - 4, y + 6); ctx.lineTo(p.x - 6, y - 3); ctx.closePath(); ctx.fill();
  } else if (p.kind === 'money') {
    ctx.fillStyle = '#7CFC98';
    ctx.fillRect(p.x - 7, y - 4, 14, 8);
    ctx.fillStyle = '#0a4d22'; ctx.font = 'bold 8px monospace'; ctx.textAlign = 'center';
    ctx.fillText('$', p.x, y + 3);
  } else if (p.kind === 'package') {
    ctx.fillStyle = '#ffd23f';
    ctx.beginPath();
    ctx.moveTo(p.x, y - 8); ctx.lineTo(p.x + 7, y); ctx.lineTo(p.x, y + 8); ctx.lineTo(p.x - 7, y);
    ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#a8720a'; ctx.fillRect(p.x - 1, y - 8, 2, 16);
  } else if (p.kind.startsWith('gun-')) {
    const col = p.kind === 'gun-shotgun' ? '#ff8c42' : p.kind === 'gun-smg' ? '#c07bff' : '#ffd23f';
    ctx.fillStyle = col;
    ctx.fillRect(p.x - 8, y - 3, 16, 6);
    ctx.fillStyle = '#222'; ctx.fillRect(p.x + 4, y - 5, 4, 4);
  }
}

const CAR_BODIES = {
  sedan: ['#c14b4b', '#4b7bc1', '#c1a54b', '#57a05e', '#888ea8', '#c17ec4'],
  sport: ['#ff2d78', '#0ff', '#ffd23f', '#ff6a00'],
  van: ['#8a8f99', '#6a7a8a', '#9a8a6a'],
  taxi: ['#f7c531'],
  police: ['#22337a'],
};

function drawCar(ctx, c, night) {
  ctx.save();
  ctx.translate(c.x, c.y);
  ctx.rotate(c.dir + Math.PI / 2);
  const L = c.len, W = c.wid;
  // shadow
  ctx.fillStyle = 'rgba(0,0,0,0.3)';
  ctx.fillRect(-W / 2 + 2, -L / 2 + 3, W, L);
  // body
  let bodyCol = c.color;
  if (c.burnt) bodyCol = '#2a2622';
  ctx.fillStyle = bodyCol;
  roundRect(ctx, -W / 2, -L / 2, W, L, 5); ctx.fill();
  // cabin
  ctx.fillStyle = c.burnt ? '#1a1815' : 'rgba(20,30,45,0.85)';
  roundRect(ctx, -W / 2 + 3, -L / 2 + L * 0.28, W - 6, L * 0.4, 3); ctx.fill();
  // windshield hint
  ctx.fillStyle = 'rgba(180,220,255,0.25)';
  ctx.fillRect(-W / 2 + 4, -L / 2 + L * 0.14, W - 8, 4);
  // type extras
  if (c.vtype === 'taxi' && !c.burnt) {
    ctx.fillStyle = '#111'; ctx.fillRect(-W / 2 + 2, -L / 2 + 2, W - 4, 4);
    ctx.fillStyle = '#f7c531'; ctx.fillRect(-W / 2 + 4, -L / 2 + 3, 6, 2);
  }
  if (c.vtype === 'police' && !c.burnt) {
    const bar = Math.floor(performance.now() / 160) % 2 === 0;
    ctx.fillStyle = bar ? '#ff3355' : '#3355ff';
    ctx.fillRect(-W / 2 + 3, -2, W - 6, 4);
    if (bar) { ctx.fillStyle = 'rgba(255,60,90,0.5)'; ctx.fillRect(-W, -30, W * 2, 60); }
  }
  if (c.siren && c.vtype === 'police') {
    const t = performance.now() / 120;
    ctx.fillStyle = Math.floor(t) % 2 ? '#ff3355' : '#4d9fff';
    ctx.fillRect(-W / 2 + 4, -4, W - 8, 8);
  }
  ctx.strokeStyle = 'rgba(0,0,0,0.5)';
  ctx.lineWidth = 1;
  roundRect(ctx, -W / 2, -L / 2, W, L, 5); ctx.stroke();
  ctx.restore();
}

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function drawPerson(ctx, x, y, dir, shirt, skin, kind, pants = '#20242b') {
  ctx.save();
  ctx.translate(x, y);
  // shadow
  ctx.fillStyle = 'rgba(0,0,0,0.35)';
  ctx.beginPath(); ctx.ellipse(1, 2, 7, 5, 0, 0, Math.PI * 2); ctx.fill();
  ctx.rotate(dir + Math.PI / 2);
  // legs
  ctx.fillStyle = pants;
  ctx.fillRect(-4, 0, 3, 7);
  ctx.fillRect(1, 0, 3, 7);
  // torso
  ctx.fillStyle = shirt;
  ctx.beginPath(); ctx.arc(0, 0, 5.5, 0, Math.PI * 2); ctx.fill();
  // arms (swing while drawn each frame; static here)
  ctx.fillStyle = shirt;
  ctx.fillRect(-7, -2, 3, 6);
  ctx.fillRect(4, -2, 3, 6);
  // head
  ctx.fillStyle = skin;
  ctx.beginPath(); ctx.arc(0, -1, 3.6, 0, Math.PI * 2); ctx.fill();
  // hats: cop cap, player band, ped none
  if (kind === 1) { ctx.fillStyle = '#0f1c3f'; ctx.fillRect(-4, -5, 8, 3); }
  if (kind === 2) { ctx.fillStyle = '#ff2d78'; ctx.fillRect(-4, -6, 8, 2); }
  ctx.restore();
}

// Car color palette + factory live in world/entities; render only reads fields.
