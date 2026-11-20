// Procedural WebAudio: music that shifts by time-of-day and heat, plus all SFX.

let ctx = null;
let master = null, musicGain = null, sfxGain = null;
let musicTimer = null;
let mode = 'day'; // day | night | chase
let step = 0;

export function initAudio() {
  if (ctx) return;
  try { ctx = new (window.AudioContext || window.webkitAudioContext)(); } catch { return; }
  master = ctx.createGain(); master.gain.value = 0.55; master.connect(ctx.destination);
  musicGain = ctx.createGain(); musicGain.gain.value = 0.4; musicGain.connect(master);
  sfxGain = ctx.createGain(); sfxGain.gain.value = 0.8; sfxGain.connect(master);
  startMusic();
}

export function setMusicMode(m) {
  if (m !== mode) { mode = m; step = 0; }
}

function tone(freq, t0, dur, type = 'square', vol = 0.2, dest = musicGain) {
  if (!ctx) return;
  const o = ctx.createOscillator(), g = ctx.createGain();
  o.type = type; o.frequency.value = freq;
  g.gain.setValueAtTime(vol, t0);
  g.gain.exponentialRampToValueAtTime(0.001, t0 + dur);
  o.connect(g); g.connect(dest);
  o.start(t0); o.stop(t0 + dur + 0.02);
}

function noise(t0, dur, vol = 0.2, hp = 800, dest = sfxGain) {
  if (!ctx) return;
  const n = Math.floor(ctx.sampleRate * dur);
  const buf = ctx.createBuffer(1, n, ctx.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / n);
  const src = ctx.createBufferSource(); src.buffer = buf;
  const f = ctx.createBiquadFilter(); f.type = 'highpass'; f.frequency.value = hp;
  const g = ctx.createGain(); g.gain.value = vol;
  src.connect(f); f.connect(g); g.connect(dest);
  src.start(t0);
}

// --- music -----------------------------------------------------------------
const SCALE_A = [0, 3, 5, 7, 10]; // minor pentatonic
const NOTE = (root, semis) => root * Math.pow(2, semis / 12);

function musicStep() {
  if (!ctx) return;
  const t = ctx.currentTime + 0.05;
  const beat = 0.24;
  const root = mode === 'chase' ? 110 : mode === 'night' ? 92 : 116;
  if (mode === 'day') {
    const mel = SCALE_A[(step * 3) % SCALE_A.length];
    tone(NOTE(root * 2, mel + 12), t, beat * 0.9, 'square', 0.10);
    if (step % 4 === 0) tone(NOTE(root, 0), t, beat * 3, 'triangle', 0.16);
    if (step % 4 === 2) tone(NOTE(root, 7), t, beat * 2, 'triangle', 0.12);
  } else if (mode === 'night') {
    if (step % 2 === 0) tone(NOTE(root, SCALE_A[(step / 2) % SCALE_A.length]), t, beat * 1.6, 'sawtooth', 0.10);
    if (step % 8 === 0) tone(root / 2, t, beat * 6, 'sine', 0.2);
    if (step % 4 === 0) noise(t, 0.05, 0.05, 6000, musicGain);
  } else {
    const mel = SCALE_A[(step * 5) % SCALE_A.length];
    tone(NOTE(root, mel), t, beat * 0.5, 'sawtooth', 0.12);
    tone(NOTE(root, mel + 12), t, beat * 0.5, 'square', 0.07);
    noise(t, 0.04, 0.12, 4000, musicGain); // snare-ish
    if (step % 2 === 0) tone(55, t, 0.1, 'sine', 0.3); // kick
  }
  step++;
}

function startMusic() {
  if (musicTimer || !ctx) return;
  musicTimer = setInterval(musicStep, 240);
}

// Rain bed: a looping filtered-noise layer whose gain tracks rain intensity.
let rainGain = null, rainSrc = null;
export function setRainLevel(level) {
  if (!ctx) return;
  if (level > 0.02 && !rainSrc) {
    const n = ctx.sampleRate * 2;
    const buf = ctx.createBuffer(1, n, ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < n; i++) d[i] = Math.random() * 2 - 1;
    rainSrc = ctx.createBufferSource();
    rainSrc.buffer = buf; rainSrc.loop = true;
    const f = ctx.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = 5200; f.Q.value = 0.4;
    rainGain = ctx.createGain(); rainGain.gain.value = 0;
    rainSrc.connect(f); f.connect(rainGain); rainGain.connect(master);
    rainSrc.start();
  }
  if (rainGain) rainGain.gain.linearRampToValueAtTime(level * 0.16, ctx.currentTime + 0.4);
  if (level <= 0.02 && rainSrc) {
    const src = rainSrc; rainSrc = null;
    setTimeout(() => { try { src.stop(); } catch { /* already stopped */ } }, 600);
  }
}

// --- radio (expansion pass) -------------------------------------------------
// Two procedural stations: NEON FM (synthwave arp) and BAY TALK (talk-blip bed).
// Toggle with R while playing; stations flip on repeated presses.
const STATIONS = [
  { name: 'NEON FM', root: 130, scale: [0, 3, 5, 7, 10], pattern: [0, 2, 4, 2, 3, 1, 4, 0], wave: 'square', beat: 0.26 },
  { name: 'BAY WAVES', root: 98, scale: [0, 2, 5, 7, 9], pattern: [0, 1, 3, 2, 4, 3, 1, 2], wave: 'triangle', beat: 0.34 },
];
let radioOn = false, radioStation = 0, radioTick = 0, radioTimer = null;

function radioStep() {
  if (!ctx || !radioOn) return;
  const st = STATIONS[radioStation];
  const t = ctx.currentTime + 0.03;
  const idx = radioTick % st.pattern.length;
  const semis = st.scale[st.pattern[idx] % st.scale.length];
  const octave = radioTick % 8 < 4 ? 2 : 1;
  tone(NOTE(st.root, semis + (radioTick % 16 >= 8 ? 12 : 0)) * (octave / 1), t, st.beat * 0.7, st.wave, 0.06);
  if (radioStation === 0 && radioTick % 4 === 0) tone(NOTE(st.root / 2, 0), t, st.beat * 1.8, 'sine', 0.10);
  // station 2: lazy surf-guitar plucks + sea-ish noise wash
  if (radioStation === 1 && radioTick % 8 === 5) noise(t, 0.12, 0.05, 3200);
  radioTick++;
}

export function toggleRadio() {
  if (!ctx) return 'off';
  radioOn = !radioOn;
  if (radioOn) {
    if (!radioTimer) radioTimer = setInterval(radioStep, 250);
  } else if (radioTimer) {
    clearInterval(radioTimer);
    radioTimer = null;
  }
  return STATIONS[radioStation].name;
}

/** Next station (or first). Returns the station name for the HUD toast. */
export function nextRadioStation() {
  if (!ctx) return 'off';
  if (!radioOn) return toggleRadio();
  radioStation = (radioStation + 1) % STATIONS.length;
  radioTick = 0;
  return STATIONS[radioStation].name;
}

export const radioName = () => (radioOn ? STATIONS[radioStation].name : 'OFF');

// --- sfx -------------------------------------------------------------------
export const sfx = {
  shoot(weapon) {
    if (!ctx) return;
    const t = ctx.currentTime;
    if (weapon === 'shotgun') { noise(t, 0.22, 0.5, 400); tone(90, t, 0.15, 'sawtooth', 0.3, sfxGain); }
    else if (weapon === 'smg') { noise(t, 0.06, 0.3, 1500); }
    else { noise(t, 0.1, 0.4, 900); tone(220, t, 0.08, 'square', 0.2, sfxGain); }
  },
  punch() { noise(ctx?.currentTime ?? 0, 0.08, 0.3, 300); },
  hurt() { tone(180, ctx?.currentTime ?? 0, 0.15, 'sawtooth', 0.25, sfxGain); },
  pickup() { const t = ctx?.currentTime ?? 0; tone(660, t, 0.08, 'square', 0.2); tone(990, t + 0.07, 0.1, 'square', 0.2); },
  cash() { const t = ctx?.currentTime ?? 0; [523, 659, 784].forEach((f, i) => tone(f, t + i * 0.06, 0.1, 'triangle', 0.2)); },
  crash() { noise(ctx?.currentTime ?? 0, 0.3, 0.5, 200); },
  skid() { noise(ctx?.currentTime ?? 0, 0.18, 0.14, 2400); },
  explosion() {
    if (!ctx) return;
    const t = ctx.currentTime;
    noise(t, 0.7, 0.8, 120);
    tone(60, t, 0.5, 'sawtooth', 0.5, sfxGain);
    tone(40, t + 0.05, 0.6, 'sine', 0.6, sfxGain);
  },
  engine(speedNorm, vtype = 'sedan') {
    if (!ctx) return;
    const t = ctx.currentTime;
    // expansion pass: per-class engine character + random pitch flutter so idle
    // burbles instead of holding one drone
    const base = vtype === 'bike' ? 95 : vtype === 'truck' ? 52 : vtype === 'sport' ? 88 : 70;
    const flutter = 0.92 + Math.random() * 0.16;
    const f = (base + speedNorm * 170) * flutter;
    const type = vtype === 'bike' ? 'square' : vtype === 'truck' ? 'sawtooth' : 'sawtooth';
    const vol = vtype === 'truck' ? 0.075 : 0.05;
    tone(f, t, 0.09, type, vol, sfxGain);
    // sport engines add a harmonic whine at high revs
    if (vtype === 'sport' && speedNorm > 0.55) tone(f * 2.02, t, 0.07, 'sine', 0.03, sfxGain);
  },
  siren(t = 0) {
    if (!ctx) return;
    const now = ctx.currentTime;
    const o = ctx.createOscillator(), g = ctx.createGain();
    o.type = 'sine';
    o.frequency.setValueAtTime(700, now + t);
    o.frequency.linearRampToValueAtTime(950, now + t + 0.35);
    o.frequency.linearRampToValueAtTime(700, now + t + 0.7);
    g.gain.setValueAtTime(0.12, now + t);
    g.gain.exponentialRampToValueAtTime(0.001, now + t + 0.72);
    o.connect(g); g.connect(sfxGain); o.start(now + t); o.stop(now + t + 0.75);
  },
  horn() { tone(310, ctx?.currentTime ?? 0, 0.3, 'square', 0.2); tone(389, ctx?.currentTime ?? 0, 0.3, 'square', 0.2); },
  ui() { tone(880, ctx?.currentTime ?? 0, 0.05, 'square', 0.12); },
  win() { const t = ctx?.currentTime ?? 0; [523, 659, 784, 1046].forEach((f, i) => tone(f, t + i * 0.1, 0.22, 'triangle', 0.25)); },
  fail() { const t = ctx?.currentTime ?? 0; [400, 330, 262, 196].forEach((f, i) => tone(f, t + i * 0.12, 0.2, 'sawtooth', 0.2)); },
  // polish pass: extra SFX
  thunder() {
    if (!ctx) return;
    const t = ctx.currentTime;
    noise(t, 1.4, 0.6, 90);
    tone(48, t, 1.1, 'sine', 0.4, sfxGain);
    tone(36, t + 0.12, 0.9, 'sine', 0.3, sfxGain);
  },
  rainAmbient(level = 0.2) {
    if (!ctx) return;
    const t = ctx.currentTime;
    noise(t, 0.5, 0.05 + level * 0.08, 2600);
  },
  carwash() { const t = ctx?.currentTime ?? 0; noise(t, 0.6, 0.25, 1800); tone(1200, t + 0.2, 0.3, 'sine', 0.1); },
  karaokeNote(good = true) {
    const t = ctx?.currentTime ?? 0;
    if (good) { [440, 554, 659].forEach((f, i) => tone(f, t + i * 0.09, 0.18, 'triangle', 0.2)); }
    else { tone(233, t, 0.4, 'sawtooth', 0.22); tone(220, t + 0.1, 0.35, 'sawtooth', 0.18); }
  },
  starUp() { const t = ctx?.currentTime ?? 0; tone(196, t, 0.14, 'square', 0.22); tone(262, t + 0.1, 0.2, 'square', 0.22); },
  checkpoint() { const t = ctx?.currentTime ?? 0; tone(1046, t, 0.07, 'square', 0.2); tone(1568, t + 0.06, 0.12, 'square', 0.18); },
};
