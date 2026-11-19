// Minimap: renders roads, player arrow, mission blips and police blips onto an
// offscreen canvas each frame, then blits the visible window into the HUD canvas.

import { CITY_W, CITY_H, roadsX, roadsY, T } from './world.js';
import { ACTIVITIES, blipTargets } from './missions.js';

const ZOOM = 2.6; // minimap px per city tile relative to fit-the-city scale

const staticMap = { canvas: null, ctx: null, scale: 1 };
let districtLabel = '';

/** Set the district name drawn in the minimap corner. */
export function setMinimapLabel(text) {
  districtLabel = text ?? '';
}

/** Build the full-city offscreen layer once (roads, beach, district tint). */
function ensureStaticMap() {
  if (staticMap.canvas) return;
  const c = document.createElement('canvas');
  c.width = CITY_W;
  c.height = CITY_H;
  const g = c.getContext('2d');
  const scale = 0.14; // offscreen is ~14% of world size; keeps memory small
  staticMap.scale = scale;
  c.width = Math.round(CITY_W * scale);
  c.height = Math.round(CITY_H * scale);
  g.fillStyle = '#0a1220';
  g.fillRect(0, 0, c.width, c.height);
  // beach strip along the bottom
  const beachTop = CITY_H - 4 * T;
  g.fillStyle = '#1d4a6e';
  g.fillRect(0, beachTop * scale, c.width, c.height - beachTop * scale);
  // roads
  g.strokeStyle = '#3d4c63';
  g.lineWidth = Math.max(1.5, T * scale * 0.55);
  g.beginPath();
  for (const rx of roadsX) { g.moveTo(rx * scale, 0); g.lineTo(rx * scale, c.height); }
  for (const ry of roadsY) { g.moveTo(0, ry * scale); g.lineTo(c.width, ry * scale); }
  g.stroke();
  // brighter arterial roads every 4th line
  g.strokeStyle = '#54688a';
  g.lineWidth = Math.max(2, T * scale * 0.7);
  g.beginPath();
  for (let j = 0; j < roadsX.length; j += 4) { g.moveTo(roadsX[j] * scale, 0); g.lineTo(roadsX[j] * scale, c.height); }
  for (let i = 0; i < roadsY.length; i += 4) { g.moveTo(0, roadsY[i] * scale); g.lineTo(c.width, roadsY[i] * scale); }
  g.stroke();
  staticMap.canvas = c;
  staticMap.ctx = g;
}

/**
 * Draw the minimap for this frame.
 * @param {CanvasRenderingContext2D} outCtx HUD minimap canvas context
 * @param {HTMLCanvasElement} outCanvas HUD minimap canvas element
 * @param {object} state game state (player, cars, enemies, clock)
 * @param {object} deps world/game refs ({ world, districtAt })
 */
export function drawMinimap(outCtx, outCanvas, state, deps = {}) {
  if (!state) return;
  ensureStaticMap();
  const W = outCanvas.width, H = outCanvas.height;
  const p = state.player;
  const viewScale = Math.min(W / CITY_W, H / CITY_H) * ZOOM * 1.6;
  const viewW = W / viewScale, viewH = H / viewScale;

  // camera center: follow the player, clamped to city bounds
  const cx = Math.min(CITY_W - viewW / 2, Math.max(viewW / 2, p.x));
  const cy = Math.min(CITY_H - viewH / 2, Math.max(viewH / 2, p.y));

  outCtx.clearRect(0, 0, W, H);

  // --- static layer (roads + beach) via offscreen canvas blit
  const s = staticMap.scale;
  outCtx.drawImage(
    staticMap.canvas,
    (cx - viewW / 2) * s, (cy - viewH / 2) * s, viewW * s, viewH * s,
    0, 0, W, H,
  );

  // --- dynamic layer drawn in world space over the blit
  outCtx.save();
  outCtx.translate(W / 2, H / 2);
  outCtx.scale(viewScale, viewScale);
  outCtx.translate(-cx, -cy);

  // night dim over the map so the minimap matches the time of day
  const dark = state.clock >= 20 || state.clock < 5.5 ? 0.5 : state.clock >= 17.5 ? (state.clock - 17.5) / 5 : 0;
  if (dark > 0) {
    outCtx.fillStyle = `rgba(5,8,20,${0.38 * dark})`;
    outCtx.fillRect(cx - viewW, cy - viewH, viewW * 2, viewH * 2);
  }

  // traffic: gray dots
  outCtx.fillStyle = 'rgba(190,200,215,0.55)';
  for (const c of state.cars) {
    if (!c.alive || c.driver === 'cop') continue;
    outCtx.fillRect(c.x - 3, c.y - 3, 6, 6);
  }

  // police blips: flashing blue/red squares, always visible
  const flash = Math.floor(performance.now() / 180) % 2 === 0;
  for (const e of state.enemies) {
    if (!e.alive || e.kind !== 'cop') continue;
    outCtx.fillStyle = flash ? '#4d9fff' : '#ff4d6d';
    outCtx.fillRect(e.x - 5, e.y - 5, 10, 10);
  }
  for (const c of state.cars) {
    if (!c.alive || c.driver !== 'cop') continue;
    outCtx.fillStyle = flash ? '#4d9fff' : '#ff4d6d';
    outCtx.fillRect(c.x - 7, c.y - 7, 14, 14);
    outCtx.strokeStyle = 'rgba(255,255,255,0.7)';
    outCtx.lineWidth = 1.5 / viewScale;
    outCtx.strokeRect(c.x - 7, c.y - 7, 14, 14);
  }
  if ((state.player.wanted ?? 0) >= 1) {
    // heat ring around the player while wanted
    outCtx.strokeStyle = `rgba(255,77,109,${0.5 + 0.3 * Math.sin(performance.now() / 140)})`;
    outCtx.lineWidth = 2.5 / viewScale;
    outCtx.beginPath(); outCtx.arc(p.x, p.y, 22, 0, Math.PI * 2); outCtx.stroke();
  }

  // activity blips (side hustles)
  for (const a of ACTIVITIES) {
    if (a.kind === 'collect' && a.done) continue;
    outCtx.fillStyle = a.kind === 'race' ? '#ffd23f' : a.kind === 'casino' ? '#c07bff' : '#5fb8a8';
    outCtx.fillRect(a.x - 4, a.y - 4, 8, 8);
  }

  // mission blips: pink for missions, cyan for other targets
  for (const b of blipTargets(state)) {
    outCtx.fillStyle = b.kind === 'mission' ? '#ff2d78' : '#0ff';
    outCtx.beginPath(); outCtx.arc(b.x, b.y, 9, 0, Math.PI * 2); outCtx.fill();
    outCtx.strokeStyle = 'rgba(255,255,255,0.75)';
    outCtx.lineWidth = 1.5 / viewScale;
    outCtx.stroke();
  }

  // player arrow
  outCtx.save();
  outCtx.translate(p.x, p.y);
  outCtx.rotate(p.dir + Math.PI / 2);
  outCtx.fillStyle = '#ffffff';
  outCtx.strokeStyle = '#0ff';
  outCtx.lineWidth = 2 / viewScale;
  outCtx.beginPath();
  outCtx.moveTo(0, -13); outCtx.lineTo(9, 10); outCtx.lineTo(0, 5); outCtx.lineTo(-9, 10);
  outCtx.closePath();
  outCtx.fill(); outCtx.stroke();
  outCtx.restore();

  outCtx.restore();

  // --- viewport chrome: frame, north edge glow, zoom hint
  outCtx.strokeStyle = '#2a4a73';
  outCtx.lineWidth = 2;
  outCtx.strokeRect(1, 1, W - 2, H - 2);
  outCtx.fillStyle = 'rgba(8,12,26,0.78)';
  if (districtLabel) {
    outCtx.font = '600 11px system-ui';
    outCtx.textAlign = 'left';
    outCtx.fillStyle = 'rgba(207,233,255,0.85)';
    outCtx.fillRect(4, H - 20, outCtx.measureText(districtLabel).width + 12, 16);
    outCtx.fillStyle = '#0ff';
    outCtx.fillText(districtLabel, 10, H - 8);
  }
}
