// HUD: DOM element updates, minimap render, toasts, banners, dialog, phone.

import { WANTED_NAMES, WEAPONS, WEATHER, money$, clamp } from './config.js';
import { skyPhase } from './render.js';
import { MISSIONS, missionState, nearbyActivities, blipTargets } from './missions.js';
import { drawMinimap, minimapZoomName } from './minimap.js';

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
    // stars + escalation notifications
    const stars = Math.floor(p.wanted);
    this.el.stars.textContent = stars > 0 ? '★'.repeat(stars) + '☆'.repeat(5 - stars) : '';
    this.el.stars.title = WANTED_NAMES[stars] ?? '';
    if (stars > (this._lastStars ?? 0)) {
      this.toast(stars >= 5 ? 'APEX HEAT — every unit in Vespera Bay is hunting you!' : 'Wanted: ' + (WANTED_NAMES[stars] ?? stars) + ' — VPD escalation!');
    }
    this._lastStars = stars;
    // weather notifications + HUD chip
    const wk = state.weather?.kind ?? 'clear';
    if (wk !== this._lastWeather) {
      if (wk === 'rain') this.toast('Rain rolling in — roads are slick.');
      else if (this._lastWeather === 'rain') this.toast('Skies clearing over the bay.');
      this._lastWeather = wk;
    }
    if (!this.wxChip) {
      this.wxChip = document.createElement('div');
      this.wxChip.style.cssText = 'color:#8fc3e0;font-size:11px;margin-top:3px;letter-spacing:1px';
      this.el.clock.parentElement.appendChild(this.wxChip);
    }
    this.wxChip.textContent = wk === 'rain' ? '☂ RAIN · grip -' : '☀ CLEAR';
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
    // minimap zoom tag under the district label (polish pass)
    if (!this.zoomTag) {
      this.zoomTag = document.createElement('div');
      this.zoomTag.style.cssText = 'color:#5f8fb0;font-size:10px;margin-top:2px;text-align:left;letter-spacing:1px';
      this.el.stars.parentElement.insertBefore(this.zoomTag, this.el.stars.parentElement.firstChild);
    }
    this.zoomTag.textContent = 'MMAP ' + minimapZoomName().toUpperCase();
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
    drawMinimap(this.mmx, this.mm, state, { world: this.world, districtLabel: this.districtLabel });
  }
}
