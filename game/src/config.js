// Neon Coast — global tuning constants and shared enums.

export const WORLD = {
  // City blocks: cells of the road grid, in tiles. Tile = 40 world units.
  cols: 26,
  rows: 22,
  tile: 40,
  // Beach occupies the bottom rows of the map.
  beachRows: 4,
};

export const PLAYER = {
  walk: 132,
  sprint: 218,
  radius: 7,
  hp: 100,
  maxArmor: 100,
  punchDmg: 16,
  kickDmg: 26,
  carExitSpeed: 260,
  // stamina: sprint drains, regenerates while walking/idle
  stamina: 100,
  sprintDrain: 14,
  staminaRegen: 9,
  minSprint: 12, // below this stamina sprint is unavailable
};

export const CAR = {
  accel: 265,
  brake: 430,
  reverse: 125,
  maxSpeed: 385,
  maxReverse: 135,
  turn: 2.6,
  grip: 0.86,
  hp: 100,
  radius: 16,
  // per-class handling overrides: top speed multiplier + turn multiplier
  classes: {
    sedan: { speed: 1.0, turn: 1.0 },
    van: { speed: 0.82, turn: 0.85 },
    sport: { speed: 1.28, turn: 1.12 },
    taxi: { speed: 1.02, turn: 1.0 },
    police: { speed: 1.14, turn: 1.06 },
    bike: { speed: 1.38, turn: 1.45 },    // fast + nimble
    truck: { speed: 0.68, turn: 0.72 },   // slow + wide turns
  },
};

export const POLICE = {
  chaseSpeed: 360,
  footSpeed: 150,
  fireRange: 320,
  bulletDmg: 8,
  wantedDecay: 5.5, // seconds of clean heat per star
  bribe: 400, // $ per star cleared at Pay'N'Spray
  // escalation ladder: per-star pursuit tuning (units per second, units, seconds)
  escalation: [
    { copCars: 0, cops: 0, carBudget: 0, fireDelay: 2.0 },           // 0 stars
    { copCars: 1, cops: 1, carBudget: 4.5, fireDelay: 1.6 },         // 1 star
    { copCars: 2, cops: 3, carBudget: 3.6, fireDelay: 1.3 },         // 2 stars
    { copCars: 3, cops: 5, carBudget: 2.8, fireDelay: 1.0 },         // 3 stars
    { copCars: 4, cops: 7, carBudget: 2.1, fireDelay: 0.8 },         // 4 stars: roadblocks
    { copCars: 6, cops: 9, carBudget: 1.5, fireDelay: 0.6 },         // 5 stars: apex heat
  ],
  ramDamage: [0, 5, 6, 8, 11, 14], // cop cruiser ram damage by star
};

// Dynamic weather: clear ↔ overcast ↔ rain (with lightning at night).
export const WEATHER = {
  changeEvery: [70, 160],   // seconds between weather rolls (random range)
  rainChance: 0.34,         // chance a roll turns into rain
  rampSeconds: 8,           // fade-in/out time for rain intensity
  maxDrops: 260,            // raindrop particles on screen
  dropSpeed: 900,           // px/s fall speed
  dropAngle: -0.32,         // slant of the rain (radians from vertical)
  gripLoss: 0.16,           // extra slipperiness while raining (0..1)
  lightningMinGap: 6,       // min seconds between lightning flashes
  puddleAlpha: 0.30,        // wet-road sheen strength at full rain
};

export const COLORS = {
  day: { sky1: '#7ec8f7', sky2: '#cfeeff', ground: '#1c2a1e', road: '#3a3f47', side: '#565b64' },
  dusk: { sky1: '#2b3a67', sky2: '#ff9d5c', ground: '#141d16', road: '#2e3238', side: '#464b53' },
  night: { sky1: '#070a18', sky2: '#101a33', ground: '#0b120d', road: '#20242b', side: '#3a4048' },
};

export const WEAPONS = [
  { id: 'fist', name: 'Fists', dmg: 16, rate: 0.34, range: 34, spread: 0, auto: false, ammoMax: Infinity, kick: 1 },
  { id: 'bat', name: 'Bat', dmg: 34, rate: 0.5, range: 46, spread: 0, auto: false, ammoMax: Infinity, kick: 2 },
  { id: 'pistol', name: 'Pistol', dmg: 22, rate: 0.3, range: 420, spread: 0.03, auto: false, ammoMax: 240, kick: 3 },
  { id: 'smg', name: 'SMG', dmg: 13, rate: 0.09, range: 380, spread: 0.07, ammoMax: 400, auto: true, kick: 2 },
  { id: 'shotgun', name: 'Shotgun', dmg: 12, rate: 0.85, range: 240, spread: 0.16, pellets: 7, ammoMax: 80, auto: false, kick: 6 },
];

export const DISTRICTS = [
  { name: 'Old Wharf', x0: 0, x1: 8, y0: 0, y1: 8, tint: '#5a4a3a' },
  { name: 'Neon Strip', x0: 9, x1: 17, y0: 0, y1: 8, tint: '#3a2a5a' },
  { name: 'Palm Heights', x0: 18, x1: 25, y0: 0, y1: 8, tint: '#2a4a3a' },
  { name: 'Industrial Zone', x0: 0, x1: 5, y0: 9, y1: 17, tint: '#4a4038' },
  { name: 'The Docks', x0: 6, x1: 11, y0: 9, y1: 17, tint: '#3a3f52' },
  { name: 'Sunfield', x0: 12, x1: 19, y0: 9, y1: 17, tint: '#4a4436' },
  { name: 'Tech Quarter', x0: 20, x1: 25, y0: 9, y1: 17, tint: '#2a3a4e' },
];

// District-specific spawn flavor: gang colors + relative cop attention per area.
export const DISTRICT_FLAVOR = {
  'Old Wharf':   { gang: '#7a5a2f', heatBias: 0.8, pedRush: 'dockworker' },
  'Neon Strip':  { gang: '#7a1f3d', heatBias: 1.2, pedRush: 'tourist' },
  'Palm Heights':{ gang: '#2f5a3d', heatBias: 1.35, pedRush: 'socialite' },
  'Industrial Zone': { gang: '#6e3a2a', heatBias: 0.7, pedRush: 'millhand' },
  'The Docks':   { gang: '#3a3f6e', heatBias: 0.9, pedRush: 'docker' },
  'Sunfield':    { gang: '#6e5a2a', heatBias: 0.75, pedRush: 'local' },
  'Tech Quarter':{ gang: '#2a5a6e', heatBias: 1.05, pedRush: 'coder' },
  'Marina Beach':{ gang: '#2a5a6e', heatBias: 0.6, pedRush: 'beachgoer' },
};

export const WANTED_NAMES = ['', 'Suspicious', 'Misdemeanor', 'Felony', 'Manhunt', 'Apex Heat'];

// Deterministic RNG (mulberry32) so the city builds the same every run unless seeded otherwise.
export function rng(seed) {
  let a = seed >>> 0;
  return function next() {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
export const lerp = (a, b, t) => a + (b - a) * t;
export const dist2 = (x1, y1, x2, y2) => { const dx = x2 - x1, dy = y2 - y1; return dx * dx + dy * dy; };
export const dist = (x1, y1, x2, y2) => Math.hypot(x2 - x1, y2 - y1);
export const angleTo = (x1, y1, x2, y2) => Math.atan2(y2 - y1, x2 - x1);
export function angleDiff(a, b) {
  let d = (b - a) % (Math.PI * 2);
  if (d > Math.PI) d -= Math.PI * 2;
  if (d < -Math.PI) d += Math.PI * 2;
  return d;
}
export const money$ = (n) => '$' + Math.floor(n).toLocaleString('en-US');
