// Palmar Bay — the HUD: money, wanted stars, health, speed, the mission
// objective, subtitles, and the circular minimap that draws the painted
// ground texture with the player, the police and the mission blip on it.

import { GROUND_SIZE, GROUND_CENTER_Z } from './textures.js';

const MINIMAP_RANGE = 130; // metres shown from the centre to the rim

export class Hud {
  constructor() {
    this.el = {
      hud: document.getElementById('hud'),
      money: document.getElementById('money'),
      objectiveText: document.getElementById('objective-text'),
      stars: document.getElementById('stars'),
      missionName: document.getElementById('mission-name'),
      minimap: document.getElementById('minimap'),
      healthFill: document.getElementById('healthfill'),
      speed: document.getElementById('speed'),
      speedNum: document.getElementById('speednum'),
      crosshair: document.getElementById('crosshair'),
      subtitle: document.getElementById('subtitle'),
      banner: document.getElementById('banner'),
      toast: document.getElementById('toast'),
      damage: document.getElementById('damage'),
      status: document.getElementById('status'),
    };
    this.mapCtx = this.el.minimap.getContext('2d');
    this.groundImage = null;
    this.mapTimer = 0;
    this.bannerTimer = 0;
    this.subtitleTimer = 0;
    this.toastTimer = 0;
    this.lastMoney = -1;
    this.lastStars = -1;
    this.lastObjective = '';
    this.lastMissionName = '';
  }

  setGroundImage(canvas) {
    this.groundImage = canvas;
  }

  show() {
    this.el.hud.classList.remove('hidden');
  }

  hide() {
    this.el.hud.classList.add('hidden');
  }

  showBanner(big, small, seconds = 2.6) {
    this.el.banner.querySelector('.big').textContent = big;
    this.el.banner.querySelector('.small').textContent = small;
    this.el.banner.classList.remove('hidden');
    this.bannerTimer = seconds;
  }

  showSubtitle(speaker, text, seconds = 4) {
    this.el.subtitle.innerHTML = speaker
      ? `<span class="speaker">${speaker}:</span> ${text}`
      : text;
    this.el.subtitle.classList.remove('hidden');
    this.subtitleTimer = seconds;
  }

  showToast(text, seconds = 3) {
    this.el.toast.textContent = text;
    this.el.toast.classList.remove('hidden');
    this.toastTimer = seconds;
  }

  flashDamage() {
    this.el.damage.style.opacity = '1';
    setTimeout(() => {
      this.el.damage.style.opacity = '0';
    }, 130);
  }

  setCrosshair(visible) {
    this.el.crosshair.classList.toggle('hidden', !visible);
  }

  update(dt, state) {
    if (state.money !== this.lastMoney) {
      this.el.money.textContent = `$${Math.floor(state.money).toLocaleString('en-US')}`;
      this.lastMoney = state.money;
    }
    if (state.objective !== this.lastObjective) {
      this.el.objectiveText.textContent = state.objective;
      this.lastObjective = state.objective;
    }
    const stars = Math.max(0, Math.min(5, Math.round(state.wanted)));
    if (stars !== this.lastStars) {
      let html = '';
      for (let i = 0; i < 5; i++) {
        html += `<span class="${i < stars ? 'lit' : 'dim'}">★</span>`;
      }
      this.el.stars.innerHTML = html;
      this.lastStars = stars;
    }
    // The mission name changes rarely: write it only when it does, like
    // the money and the objective above, instead of every frame.
    if ((state.missionName || '') !== this.lastMissionName) {
      this.el.missionName.textContent = state.missionName || '';
      this.lastMissionName = state.missionName || '';
    }
    this.el.healthFill.style.width = `${Math.max(0, Math.min(100, state.health))}%`;
    this.el.healthFill.style.background =
      state.health > 50
        ? 'linear-gradient(90deg, #37d67a, #7ee787)'
        : state.health > 25
          ? 'linear-gradient(90deg, #e8a13c, #ffd23e)'
          : 'linear-gradient(90deg, #d63c37, #ff7a6b)';
    if (state.driving) {
      this.el.speed.classList.remove('hidden');
      this.el.speedNum.textContent = String(Math.round(state.speedMph));
    } else {
      this.el.speed.classList.add('hidden');
    }

    if (this.bannerTimer > 0) {
      this.bannerTimer -= dt;
      if (this.bannerTimer <= 0) this.el.banner.classList.add('hidden');
    }
    if (this.subtitleTimer > 0) {
      this.subtitleTimer -= dt;
      if (this.subtitleTimer <= 0) this.el.subtitle.classList.add('hidden');
    }
    if (this.toastTimer > 0) {
      this.toastTimer -= dt;
      if (this.toastTimer <= 0) this.el.toast.classList.add('hidden');
    }

    this.mapTimer -= dt;
    if (this.mapTimer <= 0) {
      this.mapTimer = 0.12;
      this.drawMinimap(state);
    }
  }

  drawMinimap(state) {
    const ctx = this.mapCtx;
    const size = 200;
    const pxPerMetre = 2048 / GROUND_SIZE;
    ctx.clearRect(0, 0, size, size);
    ctx.save();
    ctx.beginPath();
    ctx.arc(size / 2, size / 2, size / 2, 0, Math.PI * 2);
    ctx.clip();

    // Painted ground, centred on the player, north up.
    if (this.groundImage) {
      const rangePx = MINIMAP_RANGE * 2 * pxPerMetre;
      const u = ((state.playerX + GROUND_SIZE / 2) / GROUND_SIZE) * 2048;
      const v = ((state.playerZ - GROUND_CENTER_Z + GROUND_SIZE / 2) / GROUND_SIZE) * 2048;
      ctx.drawImage(
        this.groundImage,
        u - rangePx / 2,
        v - rangePx / 2,
        rangePx,
        rangePx,
        0,
        0,
        size,
        size,
      );
    } else {
      ctx.fillStyle = '#22303a';
      ctx.fillRect(0, 0, size, size);
    }

    const toMap = (x, z) => [
      size / 2 + ((x - state.playerX) / MINIMAP_RANGE) * (size / 2),
      size / 2 + ((z - state.playerZ) / MINIMAP_RANGE) * (size / 2),
    ];

    // Mission blip: a pulsing yellow diamond.
    if (state.missionBlip) {
      const [mx, my] = toMap(state.missionBlip.x, state.missionBlip.z);
      const pulse = 5 + Math.sin(performance.now() / 180) * 2;
      ctx.fillStyle = '#ffd23e';
      ctx.beginPath();
      ctx.moveTo(mx, my - pulse);
      ctx.lineTo(mx + pulse, my);
      ctx.lineTo(mx, my + pulse);
      ctx.lineTo(mx - pulse, my);
      ctx.closePath();
      ctx.fill();
      ctx.strokeStyle = '#000';
      ctx.lineWidth = 1.5;
      ctx.stroke();
    }

    // Traffic: small white dots. Police: flashing blue/red dots.
    ctx.fillStyle = '#ffffff';
    for (const car of state.traffic || []) {
      const [x, y] = toMap(car.x, car.z);
      if (x < -4 || x > size + 4 || y < -4 || y > size + 4) continue;
      ctx.fillRect(x - 1.5, y - 1.5, 3, 3);
    }
    const flash = Math.floor(performance.now() / 300) % 2 === 0;
    ctx.fillStyle = flash ? '#3b82ff' : '#ff3b30';
    for (const cop of state.police || []) {
      const [x, y] = toMap(cop.x, cop.z);
      if (x < -4 || x > size + 4 || y < -4 || y > size + 4) continue;
      ctx.beginPath();
      ctx.arc(x, y, 3.5, 0, Math.PI * 2);
      ctx.fill();
    }

    // Player: a white arrow pointing along the heading.
    const cx = size / 2;
    const cy = size / 2;
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(state.playerHeading);
    ctx.fillStyle = '#ffffff';
    ctx.strokeStyle = '#000';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(0, -8);
    ctx.lineTo(5.5, 6);
    ctx.lineTo(0, 3);
    ctx.lineTo(-5.5, 6);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.restore();

    ctx.restore();
  }
}
