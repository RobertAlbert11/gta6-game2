// Vespera Bay: city generation — road grid, districts, buildings, props, beach.
// Coordinates are world units; one tile = WORLD.tile units. The grid is cols x rows
// of blocks separated by roads; y grows downward, beach at high y.

import { WORLD, DISTRICTS, DISTRICT_FLAVOR, rng } from './config.js';

// District-flavored props: each block decorates itself with items matching its
// district (crates at the docks, benches in parks, neon planters on the strip...).
const DISTRICT_PROPS = {
  'Old Wharf':   ['crate', 'barrel', 'bollard'],
  'Neon Strip':  ['planter', 'signpost', 'bench'],
  'Palm Heights': ['hedge', 'fountain', 'bench'],
  'The Docks':   ['container', 'crate', 'winch'],
  'Sunfield':    ['bench', 'hydrant', 'trashcan'],
  'Marina Beach': ['umbrella', 'towel', 'cooler'],
  'Industrial Zone': ['pipestack', 'spool', 'gantry', 'oilbarrel'],
  'Tech Quarter': ['servercrate', 'antenna', 'cool vent', 'cablecoil'],
};
const PROP_COLORS = {
  crate: '#8a6a42', barrel: '#5a6a72', bollard: '#4a4e56', planter: '#3f6a46',
  signpost: '#6a7482', bench: '#7a5a3a', hedge: '#2c5232', fountain: '#5a7a8a',
  container: '#8a3a3a', winch: '#5a5a66', hydrant: '#c14b4b', trashcan: '#4a5560',
  umbrella: '#ff8c5a', towel: '#5ab8ff', cooler: '#d9d9e2',
  pipestack: '#7a8288', spool: '#a88a4a', gantry: '#5a6e7e', oilbarrel: '#3a4a3a',
  servercrate: '#3a4a5e', antenna: '#9aa8b8', 'cool vent': '#6a8296', cablecoil: '#c17e2a',
};
// "Interior" props: rendered inside building footprints (visible through lit
// windows / through open doorways) — foundries, labs, offices and the like.
const INTERIOR_PROPS = {
  'Industrial Zone': ['forge', 'assemblyline', 'palletstack'],
  'Tech Quarter': ['serverrack', 'holotable', 'deskcluster'],
  'The Docks': ['forklift', 'cargonet'],
  'Neon Strip': ['stage', 'barrow'],
  'Palm Heights': ['chandelier', 'grandpiano'],
  'Old Wharf': ['fishrack', 'ropecoil'],
  'Sunfield': ['kitchentable'],
};
const INTERIOR_COLORS = {
  forge: '#c14b2a', assemblyline: '#6a7482', palletstack: '#8a6a42',
  serverrack: '#2a4a6e', holotable: '#2ac1b8', deskcluster: '#8a7a5a',
  forklift: '#c18a2a', cargonet: '#4a5a6e', stage: '#7a2a5a', barrow: '#5a6a72',
  chandelier: '#ffd23f', grandpiano: '#1a1a20', fishrack: '#7a5a3a',
  ropecoil: '#a88a4a', kitchentable: '#7a5a3a',
};

export const T = WORLD.tile;
const COLS = WORLD.cols, ROWS = WORLD.rows;
export const CITY_W = COLS * T + T;
export const CITY_H = ROWS * T + T;

// Road junctions sit every T units; a block cell is the T x T area between roads.
// roadsX[j] = world x of vertical road center j; roadsY[i] likewise.
export const roadsX = [], roadsY = [];
for (let j = 0; j <= COLS; j++) roadsX.push(T / 2 + j * T);
for (let i = 0; i <= ROWS; i++) roadsY.push(T / 2 + i * T);

export const isBeachRow = (i) => i >= ROWS - WORLD.beachRows;

export function districtAt(x, y) {
  if (y >= roadsY[ROWS - WORLD.beachRows] ) return { name: 'Marina Beach', tint: '#b89a6a' };
  const cj = Math.min(COLS - 1, Math.max(0, Math.floor((x - T / 2) / T)));
  const ci = Math.min(ROWS - 1, Math.max(0, Math.floor((y - T / 2) / T)));
  for (const d of DISTRICTS) if (cj >= d.x0 && cj <= d.x1 && ci >= d.y0 && ci <= d.y1) return d;
  return DISTRICTS[0];
}

/** Snap a point to the nearest road center line (for AI navigation). */
export function nearestRoad(x, y) {
  let bx = roadsX[0], by = roadsY[0], bd = Infinity;
  for (const rx of roadsX) { const d = Math.abs(rx - x); if (d < bd) { bd = d; bx = rx; } }
  bd = Infinity;
  for (const ry of roadsY) { const d = Math.abs(ry - y); if (d < bd) { bd = d; by = ry; } }
  return { x: bx, y: by };
}

export class World {
  constructor(seed = 7) {
    this.seed = seed;
    this.rand = rng(seed);
    this.blocks = [];     // { x,y,w,h, kind:'building'|'park'|'lot', buildings:[...], props:[...] }
    this.lamps = [];      // street lamps
    this.neons = [];      // neon signs { x, y, text, color, w }
    this.palms = [];      // beach palms + park trees
    this.spawns = { peds: [], cars: [], police: [] };
    this.interest = [];   // mission/activity trigger spots get appended by missions.js
    this.roadLights = []; // traffic lights at intersections { x, y, phase }
    this.build();
  }

  build() {
    const R = this.rand;
    // traffic light phases: alternate EW/NS green by intersection parity
    for (let j = 0; j <= COLS; j += 1) for (let i = 0; i <= ROWS; i += 1) {
      if ((j + i) % 2 === 0) continue;
      this.roadLights.push({ x: roadsX[j], y: roadsY[i], phase: (i + j) % 2 });
    }
    for (let cj = 0; cj < COLS; cj++) {
      for (let ci = 0; ci < ROWS; ci++) {
        if (isBeachRow(ci)) continue;
        const bx = roadsX[cj] + T / 2, by = roadsY[ci] + T / 2;
        const d = DISTRICTS.find((dd) => cj >= dd.x0 && cj <= dd.x1 && ci >= dd.y0 && ci <= dd.y1);
        const roll = R();
        const kind = roll < 0.10 ? 'park' : roll < 0.16 ? 'lot' : 'building';
        const block = { x: bx, y: by, w: T - 14, h: T - 14, kind, buildings: [], props: [], district: d?.name ?? 'Vespera' };
        if (kind === 'building') {
          // subdivide the block into 1-4 buildings
          const n = R() < 0.5 ? 1 : R() < 0.75 ? 2 : 4;
          const pad = 6;
          const put = (x, y, w, h) => {
            const tall = d && d.name === 'Palm Heights' ? 30 + R() * 60 : 18 + R() * 34;
            block.buildings.push({ x, y, w, h, tall, hue: R(), winSeed: Math.floor(R() * 1e9), neon: R() < 0.22 && d?.name === 'Neon Strip' });
            // interior prop: big buildings in prop-rich districts get furniture/machinery
            const interior = INTERIOR_PROPS[d?.name];
            if (interior && w > 60 && h > 50 && R() < 0.7) {
              const ikind = interior[Math.floor(R() * interior.length)];
              block.props.push({
                kind: ikind, interior: true,
                x: x + w / 2 + (R() - 0.5) * (w - 30),
                y: y + h / 2 + (R() - 0.5) * (h - 30),
                color: INTERIOR_COLORS[ikind] ?? '#667',
                rot: R() * Math.PI,
              });
            }
          };
          if (n === 1) put(bx + pad, by + pad, block.w - 2 * pad, block.h - 2 * pad);
          else if (n === 2) { put(bx + pad, by + pad, block.w - 2 * pad, block.h / 2 - pad); put(bx + pad, by + block.h / 2 + 2, block.w - 2 * pad, block.h / 2 - pad - 2); }
          else {
            const hw = block.w / 2, hh = block.h / 2;
            put(bx + pad, by + pad, hw - pad - 2, hh - pad - 2);
            put(bx + hw + 2, by + pad, hw - pad - 2, hh - pad - 2);
            put(bx + pad, by + hh + 2, hw - pad - 2, hh - pad - 2);
            put(bx + hw + 2, by + hh + 2, hw - pad - 2, hh - pad - 2);
          }
        } else if (kind === 'park') {
          const trees = 3 + Math.floor(R() * 5);
          for (let k = 0; k < trees; k++) this.palms.push({ x: bx + 10 + R() * (block.w - 20), y: by + 10 + R() * (block.h - 20), park: true });
        } else {
          // parking lot: occasional parked car spawn point
          this.spawns.cars.push({ x: bx, y: by, parked: true });
        }
        this.blocks.push(block);
        // district-flavored props scattered on the block (2-4 per block)
        const flavor = DISTRICT_PROPS[d?.name] ?? DISTRICT_PROPS['Sunfield'];
        const nProps = 2 + Math.floor(R() * 3);
        for (let k = 0; k < nProps; k++) {
          const kind = flavor[Math.floor(R() * flavor.length)];
          block.props.push({
            kind,
            x: bx + (R() - 0.5) * (block.w - 18),
            y: by + (R() - 0.5) * (block.h - 18),
            color: PROP_COLORS[kind] ?? '#777',
            rot: R() * Math.PI,
          });
        }
        // street lamps at block corners
        if ((cj + ci) % 2 === 0) this.lamps.push({ x: roadsX[cj] + 10, y: roadsY[ci] + 10 });
      }
    }
    // beach palms along the boardwalk
    for (let k = 0; k < 26; k++) this.palms.push({ x: 60 + R() * (CITY_W - 120), y: roadsY[ROWS - WORLD.beachRows] + 26 + R() * 40, park: false });
    // named landmarks for the HUD + missions flavor
    this.landmarks = [
      { x: roadsX[14] + 30, y: roadsY[6] + 30, name: "Lucky 7 Casino" },
      { x: roadsX[21] + 30, y: roadsY[4] + 30, name: 'Kross Tower' },
      { x: roadsX[19] + 30, y: roadsY[10] + 30, name: 'St. Aurelia' },
      { x: roadsX[3] + 30, y: roadsY[14] + 30, name: 'Pier Warehouse' },
      { x: CITY_W / 2, y: roadsY[ROWS - WORLD.beachRows] + 60, name: 'Boardwalk' },
      // expansion pass: landmarks for the two new districts + flavor extras
      { x: roadsX[2] + 30, y: roadsY[12] + 30, name: 'Vulcan Foundry' },
      { x: roadsX[4] + 30, y: roadsY[16] + 30, name: 'Freight Yard' },
      { x: roadsX[22] + 30, y: roadsY[12] + 30, name: 'Hexon Dataworks' },
      { x: roadsX[24] + 30, y: roadsY[15] + 30, name: 'Serverfarm 9' },
      { x: roadsX[11] + 30, y: roadsY[1] + 30, name: 'Shrine of Song' },
      { x: roadsX[7] + 30, y: roadsY[3] + 30, name: 'Wharf Lighthouse' },
      { x: roadsX[16] + 30, y: roadsY[15] + 30, name: 'Sunfield Market' },
    ];
    // neon signs on random Neon Strip buildings
    const words = ['EMBER', 'PALMS', 'ROXY', 'LUCKY 7', 'CASA AZUL', 'VELVET', 'DINER', 'MOTEL', 'CLUB NOX', 'PAWN', 'TATTOO', 'RAMEN'];
    for (const b of this.blocks) for (const bd of b.buildings) {
      if (bd.neon) {
        this.neons.push({ x: bd.x + bd.w / 2, y: bd.y + bd.h, text: words[Math.floor(R() * words.length)], color: ['#ff2d78', '#0ff', '#ffd23f', '#7dff9a'][Math.floor(R() * 4)] });
        bd.neon = false;
      }
    }
    // beach umbrellas + lifeguard towers along the sand
    for (let k = 0; k < 10; k++) {
      this.umbrellas = this.umbrellas ?? [];
      this.umbrellas.push({
        x: 80 + R() * (CITY_W - 160),
        y: roadsY[ROWS - WORLD.beachRows] + 70 + R() * (WORLD.beachRows * T - 120),
        color: ['#ff5f7a', '#5fb8ff', '#ffd23f', '#7dff9a'][Math.floor(R() * 4)],
      });
    }
    for (let k = 0; k < 3; k++) {
      this.towers = this.towers ?? [];
      this.towers.push({ x: 200 + k * (CITY_W - 400) / 2, y: roadsY[ROWS - 1] + 20 });
    }
    // ped + traffic spawn points on sidewalks and roads
    for (let k = 0; k < 220; k++) {
      const j = Math.floor(R() * (COLS + 1)), i = Math.floor(R() * (ROWS - WORLD.beachRows + 1));
      const vert = R() < 0.5;
      const along = R() * T * (vert ? ROWS - WORLD.beachRows : COLS);
      if (vert) this.spawns.peds.push({ x: roadsX[j] + (R() < 0.5 ? -1 : 1) * (T / 2 - 8), y: T / 2 + along });
      else this.spawns.peds.push({ x: T / 2 + Math.min(along, COLS * T), y: roadsY[Math.min(i, ROWS - WORLD.beachRows)] + (R() < 0.5 ? -1 : 1) * (T / 2 - 8) });
    }
    for (let k = 0; k < 130; k++) {
      const j = Math.floor(R() * (COLS + 1)), i = Math.floor(R() * (ROWS - WORLD.beachRows + 1));
      const vert = R() < 0.5;
      if (vert) this.spawns.cars.push({ x: roadsX[j] + (R() < 0.5 ? -1 : 1) * 5, y: 40 + R() * (ROWS - WORLD.beachRows) * T, dir: R() < 0.5 ? 0 : Math.PI, road: 'v' });
      else this.spawns.cars.push({ x: 40 + R() * COLS * T, y: roadsY[Math.min(i, ROWS - WORLD.beachRows)] + (R() < 0.5 ? -1 : 1) * 5, dir: R() < 0.5 ? -Math.PI / 2 : Math.PI / 2, road: 'h' });
    }
  }

  /** Pick a random road point at least `minD` away from (x,y). */
  randomRoadPoint(R, x, y, minD = 600) {
    for (let tries = 0; tries < 40; tries++) {
      const p = this.spawns.cars[Math.floor(R() * this.spawns.cars.length)];
      if (p && Math.hypot(p.x - x, p.y - y) > minD) return { x: p.x, y: p.y };
    }
    return { x, y };
  }
}
