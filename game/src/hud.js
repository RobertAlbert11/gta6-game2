// HUD: DOM element updates, minimap render, toasts, banners, dialog, phone.

import { WANTED_NAMES, money$, clamp } from './config.js';
import { CITY_W, CITY_H, roadsX, roadsY } from './world.js';
import { WEAPONS } from './config.js';
import { skyPhase } from './render.js';
import { MISSIONS, missionState, ACTIVITIES, nearbyActivities, blipTargets } from './missions.js';

const $ = (id) => document.getElementById(id);

export class Hud {
  constructor(canvas) {
    this.view = canvas;
    this.mm = $('minimap');
    this.mmx = this.mm.getContext('2d');
    this.el = {
      stars: $('stars'), money: $('money'), clock: $('clock'),
      hp: $('hpFill'), ar: $('arFill'), speedo: $('speedo'), weap: $('weap'),
      track: $('missionTrack'), trackTitle: $('missionTrack').querySelector('.mtitle'),
      trackObj: $('missionTrack').querySelector('.mobj'),
      toasts: $('toasts'), banner: $('banner'), b1: $('banner').querySelector('.b1'), b2: $('banner').querySelector('.b2'),
      dialog: $('dialog'), who: $('dialog').querySelector('.who'), say: $('dialog').querySelector('.say'),
      phone: $('phone'), actList: $('actList'),
    };
    this.toastList = [];
    this.bannerT = 0;
    this.dialogT = 0;
  }

  show(on) { $('hud').classList.toggle('hidden', !on); }

  toast(text) {
    this.toastList.push({ text, t: 4 });
    if (this.toastList.length > 4) this.toastList.shift();
    this.renderToasts();
  }

  bannerBig(l1, l2) {
    this.el.b1.textContent = l1;
    this.el.b2.textContent = l2 ?? '';
    this.el.banner.style.display = 'block';
    this.bannerT = 3.4;
  }

  dialogOpen(who, say) {
    this.el.who.textContent = who;
    this.el.say.textContent = say;
    this.el.dialog.style.display = 'block';
    this.dialogT = 6;
  }

  dialogAdvance() {
    this.dialogT = Math.min(this.dialogT, 0.01);
  }

  renderToasts() {
    this.el.toasts.innerHTML = '';
    for (const t of this.toastList) {
      const div = document.createElement('div');
      div.className = 'toast';
      div.textContent = t.text;
      this.el.toasts.appendChild(div);
    }
  }

  api(state) {
    return {
      toast: (t) => this.toast(t),
      banner: (a, b) => this.bannerBig(a, b),
      dialog: (who, say) => this.dialogOpen(who, say),
      money: (n) => { state.player.money += n; },
      heat: (n) => { state.player.wanted = clamp(state.player.wanted + n, 0, 5); },
      spawnGang: (x, y, n) => { for (let k = 0; k < n; k++) import('./entities.js').then((m) => m.spawnGangster(state, x + k * 14, y)); },
      pickup: (x, y, kind) => { import('./entities.js').then((m) => m.dropPickup(state, kind, x, y)); },
    };
  }

  update(state, dt) {
    const p = state.player;
    // stars
    const stars = Math.floor(p.wanted);
    this.el.stars.textContent = stars > 0 ? '★'.repeat(stars) + '☆'.repeat(5 - stars) : '';
    this.el.stars.title = WANTED_NAMES[stars] ?? '';
    // money/clock
    this.el.money.textContent = money$(p.money);
    const h = Math.floor(state.clock), m = Math.floor((state.clock - h) * 60);
    const ph = skyPhase(state.clock);
    this.el.clock.textContent = `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')} · ${ph.name} · Day ${state.day}`;
    // bars (health, armor, stamina)
    this.el.hp.style.width = clamp(p.hp, 0, 100) + '%';
    this.el.ar.style.width = clamp(p.armor, 0, 100) + '%';
    if (!this.stamBar) {
      this.stamBar = document.createElement('div');
      this.stamBar.className = 'bar';
      this.stamBar.innerHTML = '<div id="stFill" style="background:linear-gradient(90deg,#39d353,#c8ff6f)"></div>';
      this.el.ar.parentElement.parentElement.appendChild(this.stamBar);
      this.stamFill = this.stamBar.querySelector('div');
    }
    this.stamFill.style.width = clamp(p.stamina ?? 100, 0, 100) + '%';
    // speed + weapon
    const spd = p.inCar ? Math.abs(Math.round(p.inCar.speed * 0.6)) : Math.round(p.sprintT > 0 ? 12 : 6);
    this.el.speedo.textContent = p.inCar ? spd + ' mph' : '';
    const w = WEAPONS[p.weapon];
    const ammo = w.ammoMax === Infinity ? '' : ' · ' + (p.ammo[w.id] ?? 0);
    this.el.weap.textContent = p.inCar ? 'Drive-by ready' : w.name + ammo;
    // mission tracker
    if (missionState.active) {
      this.el.track.style.display = 'inline-block';
      this.el.trackTitle.textContent = missionState.active.def.title;
      const step = missionState.active.def.steps[missionState.active.stepIndex];
      this.el.trackObj.textContent = step ? step.text : '';
    } else {
      const next = MISSIONS[missionState.nextIndex];
      if (next) {
        this.el.track.style.display = 'inline-block';
        this.el.trackTitle.textContent = 'Next: ' + next.title;
        this.el.trackObj.textContent = 'Go to ' + next.giver.replace(/([A-Z])/g, ' $1').toLowerCase() + ' marker';
      } else {
        this.el.track.style.display = 'none';
      }
    }
    // phone activity list
    if (state.phoneOpen) {
      this.el.phone.style.display = 'block';
      const near = nearbyActivities(state, 6);
      this.el.actList.innerHTML = '';
      for (const a of near) {
        const row = document.createElement('div');
        row.className = 'actrow';
        const d = Math.round(Math.hypot(a.x - p.x, a.y - p.y));
        row.innerHTML = `<span>${a.name}</span><span class="k">${a.kind === 'collect' && a.done ? '✓' : d + 'm'}</span>`;
        this.el.actList.appendChild(row);
      }
    } else this.el.phone.style.display = 'none';
    // toasts decay
    let dirty = false;
    for (const t of this.toastList) { t.t -= dt; if (t.t <= 0) dirty = true; }
    if (dirty) { this.toastList = this.toastList.filter((t) => t.t > 0); this.renderToasts(); }
    // banner decay
    if (this.bannerT > 0) {
      this.bannerT -= dt;
      if (this.bannerT <= 0) this.el.banner.style.display = 'none';
    }
    if (this.dialogT > 0) {
      this.dialogT -= dt;
      if (this.dialogT <= 0) this.el.dialog.style.display = 'none';
    }
    // minimap
    this.drawMinimap(state);
  }

  drawMinimap(state) {
    const g = this.mmx;
    const W = this.mm.width, H = this.mm.height;
    g.clearRect(0, 0, W, H);
    g.fillStyle = '#0a1220';
    g.fillRect(0, 0, W, H);
    const scale = Math.min(W / CITY_W, H / CITY_H) * 2.6;
    const p = state.player;
    const cx = clamp(p.x, W / (2 * scale), CITY_W - W / (2 * scale));
    const cy = clamp(p.y, H / (2 * scale), CITY_H - H / (2 * scale));
    g.save();
    g.scale(scale, scale);
    g.translate(-cx + W / (2 * scale), -cy + H / (2 * scale));
    // roads
    g.strokeStyle = '#2c3a4d';
    g.lineWidth = 14;
    g.beginPath();
    for (const rx of roadsX) { g.moveTo(rx, 0); g.lineTo(rx, CITY_H); }
    for (const ry of roadsY) { g.moveTo(0, ry); g.lineTo(CITY_W, ry); }
    g.stroke();
    // beach strip
    g.fillStyle = '#20486a';
    g.fillRect(0, CITY_H - 4 * 40, CITY_W, 4 * 40);
    // districts labels skipped on mini
    // activity blips
    for (const a of ACTIVITIES) {
      if (a.kind === 'collect' && a.done) continue;
      g.fillStyle = a.kind === 'race' ? '#ffd23f' : a.kind === 'casino' ? '#c07bff' : '#5fb8a8';
      g.fillRect(a.x - 4, a.y - 4, 8, 8);
    }
    // mission blips
    for (const b of blipTargets(state)) {
      g.fillStyle = b.kind === 'mission' ? '#ff2d78' : '#0ff';
      g.beginPath(); g.arc(b.x, b.y, 9, 0, Math.PI * 2); g.fill();
    }
    // player
    g.fillStyle = '#ffffff';
    g.save();
    g.translate(p.x, p.y);
    g.rotate(p.dir + Math.PI / 2);
    g.beginPath(); g.moveTo(0, -10); g.lineTo(7, 8); g.lineTo(-7, 8); g.closePath(); g.fill();
    g.restore();
    g.restore();
    // frame
    g.strokeStyle = '#2a4a73';
    g.strokeRect(0.5, 0.5, W - 1, H - 1);
  }
}
