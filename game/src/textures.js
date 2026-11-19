// Palmar Bay — every texture in the game is painted here on a canvas at
// load time. No image files, no network: the city, the roads, the sea and
// the sky are all drawn by code, so the game is fully self-contained.

import * as THREE from 'three';
import { WORLD, CITY_HALF } from './config.js';

function makeCanvas(width, height) {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  return { canvas, ctx: canvas.getContext('2d') };
}

function toTexture(canvas, repeatX = 1, repeatY = 1) {
  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(repeatX, repeatY);
  texture.anisotropy = 4;
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

// The ground is one big painted plane: sidewalks, asphalt roads with lane
// markings and crosswalks, the beach and the water's edge. The plane is
// GROUND_SIZE metres across, centred at (0, GROUND_CENTER_Z).
export const GROUND_SIZE = 640;
export const GROUND_CENTER_Z = 20;

export function worldToGroundUv(x, z) {
  return [(x + GROUND_SIZE / 2) / GROUND_SIZE, (z - GROUND_CENTER_Z + GROUND_SIZE / 2) / GROUND_SIZE];
}

export function buildGroundTexture() {
  const S = 2048;
  const { canvas, ctx } = makeCanvas(S, S);
  const px = (metres) => (metres / GROUND_SIZE) * S;
  const gx = (x) => (x + GROUND_SIZE / 2) / GROUND_SIZE * S;
  const gz = (z) => (z - GROUND_CENTER_Z + GROUND_SIZE / 2) / GROUND_SIZE * S;

  // Base: warm pale concrete for the whole city.
  ctx.fillStyle = '#b7ab93';
  ctx.fillRect(0, 0, S, S);

  // Subtle patchwork so the ground is not flat.
  const patch = makePatchRng(7);
  for (let i = 0; i < 900; i++) {
    const shade = patch();
    ctx.fillStyle = shade > 0.66 ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)';
    ctx.fillRect(patch() * S, patch() * S, 20 + patch() * 60, 20 + patch() * 60);
  }

  // Beach sand along the south edge, then the sea.
  ctx.fillStyle = '#e9d6a4';
  ctx.fillRect(0, gz(WORLD.BEACH_Z), S, gz(WORLD.WATER_Z) - gz(WORLD.BEACH_Z));
  // Speckle on the sand, so the beach is not a flat sheet. Seeded like the
  // patchwork above, so the ground is the same on every load.
  const sand = makePatchRng(21);
  for (let i = 0; i < 500; i++) {
    const x = sand() * S;
    const y = gz(WORLD.BEACH_Z) + sand() * (gz(WORLD.WATER_Z) - gz(WORLD.BEACH_Z));
    ctx.fillStyle = sand() > 0.5 ? 'rgba(255,255,255,0.10)' : 'rgba(120,90,40,0.10)';
    ctx.fillRect(x, y, 2 + sand() * 3, 2 + sand() * 3);
  }
  ctx.fillStyle = '#2e7fa8';
  ctx.fillRect(0, gz(WORLD.WATER_Z), S, S - gz(WORLD.WATER_Z));
  ctx.fillStyle = 'rgba(255,255,255,0.25)';
  for (let x = 0; x < S; x += 90) {
    ctx.fillRect(x, gz(WORLD.WATER_Z) - 3, 55, 3);
  }

  // City blocks: slightly darker pavement slabs.
  const half = CITY_HALF;
  for (let i = 0; i < WORLD.GRID; i++) {
    for (let j = 0; j < WORLD.GRID; j++) {
      const cx = (i - (WORLD.GRID - 1) / 2) * WORLD.PITCH;
      const cz = (j - (WORLD.GRID - 1) / 2) * WORLD.PITCH;
      if (cz + WORLD.BLOCK / 2 > WORLD.BEACH_Z) continue; // the beach rows have no blocks
      ctx.fillStyle = (i + j) % 2 === 0 ? '#a89c83' : '#a2987f';
      ctx.fillRect(gx(cx - WORLD.BLOCK / 2), gz(cz - WORLD.BLOCK / 2), px(WORLD.BLOCK), px(WORLD.BLOCK));
    }
  }

  // Roads: asphalt strips between the blocks, with edge lines.
  const roadCentres = [];
  for (let i = 0; i < WORLD.GRID - 1; i++) {
    roadCentres.push((i - (WORLD.GRID - 1) / 2) * WORLD.PITCH + WORLD.PITCH / 2);
  }
  ctx.fillStyle = '#484b53';
  for (const c of roadCentres) {
    ctx.fillRect(gx(c - WORLD.ROAD / 2), gz(-half - WORLD.ROAD / 2), px(WORLD.ROAD), px(2 * half + WORLD.ROAD));
    ctx.fillRect(gx(-half - WORLD.ROAD / 2), gz(c - WORLD.ROAD / 2), px(2 * half + WORLD.ROAD), px(WORLD.ROAD));
  }

  // Lane markings: dashed centre lines, white edge lines.
  ctx.strokeStyle = 'rgba(255,255,255,0.55)';
  ctx.lineWidth = 2;
  ctx.setLineDash([18, 22]);
  for (const c of roadCentres) {
    ctx.beginPath();
    ctx.moveTo(gx(c), gz(-half - WORLD.ROAD / 2));
    ctx.lineTo(gx(c), gz(half + WORLD.ROAD / 2));
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(gx(-half - WORLD.ROAD / 2), gz(c));
    ctx.lineTo(gx(half + WORLD.ROAD / 2), gz(c));
    ctx.stroke();
  }
  ctx.setLineDash([]);

  // Crosswalks at every intersection.
  ctx.fillStyle = 'rgba(255,255,255,0.75)';
  for (const cx of roadCentres) {
    for (const cz of roadCentres) {
      for (let k = -2; k <= 2; k++) {
        ctx.fillRect(gx(cx + k * 2.6 - 1), gz(cz - WORLD.ROAD / 2 + 1), px(2), px(4));
        ctx.fillRect(gx(cx + k * 2.6 - 1), gz(cz + WORLD.ROAD / 2 - 5), px(2), px(4));
      }
    }
  }

  // Central plaza: a roundabout garden in the middle of downtown.
  ctx.fillStyle = '#7fae7f';
  ctx.beginPath();
  ctx.arc(gx(0), gz(0), px(16), 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = '#d8cfae';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.arc(gx(0), gz(0), px(16), 0, Math.PI * 2);
  ctx.stroke();

  return toTexture(canvas);
}

function makePatchRng(seed) {
  let a = seed >>> 0;
  return function next() {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Three facade variants. Each is a tall window grid; instanced buildings
// share one of the three, so the skyline reads as varied without a texture
// per building.
export function buildFacadeTextures() {
  const variants = [
    { base: '#5d7ea6', glass: '#1d2f45', lit: '#ffd27a', trim: '#48678a' }, // glass blue
    { base: '#c9a06b', glass: '#2b2620', lit: '#ffe9a8', trim: '#a8895f' }, // warm sandstone
    { base: '#8a5f4d', glass: '#241d18', lit: '#ffc46b', trim: '#6d4636' }, // brick red
  ];
  return variants.map((v, index) => {
    const { canvas, ctx } = makeCanvas(256, 512);
    ctx.fillStyle = v.base;
    ctx.fillRect(0, 0, 256, 512);
    // Vertical shading so the face is not flat.
    const grad = ctx.createLinearGradient(0, 0, 256, 0);
    grad.addColorStop(0, 'rgba(0,0,0,0.25)');
    grad.addColorStop(0.5, 'rgba(255,255,255,0.08)');
    grad.addColorStop(1, 'rgba(0,0,0,0.25)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 256, 512);
    // Window grid.
    const rng = makePatchRng(100 + index * 37);
    const cols = 6;
    const rows = 15;
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const x = 14 + c * 40;
        const y = 16 + r * 32;
        const lit = rng() < 0.22;
        ctx.fillStyle = lit ? v.lit : v.glass;
        ctx.fillRect(x, y, 26, 20);
        if (!lit) {
          ctx.fillStyle = 'rgba(255,255,255,0.18)';
          ctx.fillRect(x, y, 26, 6);
        }
      }
    }
    // Ground floor: shopfronts.
    ctx.fillStyle = v.trim;
    ctx.fillRect(0, 480, 256, 32);
    ctx.fillStyle = 'rgba(255,255,255,0.65)';
    for (let c = 0; c < 3; c++) {
      ctx.fillRect(14 + c * 84, 486, 70, 20);
    }
    return toTexture(canvas);
  });
}

// Soft repeating waves for the sea plane.
export function buildWaterTexture() {
  const { canvas, ctx } = makeCanvas(256, 256);
  ctx.fillStyle = '#2e7fa8';
  ctx.fillRect(0, 0, 256, 256);
  ctx.strokeStyle = 'rgba(255,255,255,0.28)';
  ctx.lineWidth = 2;
  const rng = makePatchRng(55);
  for (let i = 0; i < 26; i++) {
    const y = rng() * 256;
    ctx.beginPath();
    ctx.moveTo(rng() * 100, y);
    ctx.bezierCurveTo(80, y - 8, 170, y + 8, 256, y - 4);
    ctx.stroke();
  }
  const texture = toTexture(canvas, 6, 3);
  return texture;
}

// Vertical gradient for the sky dome. Colours arrive as hex numbers.
export function buildSkyTexture(top, horizon) {
  const hex = (n) => `#${n.toString(16).padStart(6, '0')}`;
  const { canvas, ctx } = makeCanvas(16, 256);
  const grad = ctx.createLinearGradient(0, 0, 0, 256);
  grad.addColorStop(0, hex(top));
  grad.addColorStop(0.55, '#8fc3e8');
  grad.addColorStop(0.78, hex(horizon));
  grad.addColorStop(1, '#ffe0b0');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 16, 256);
  return toTexture(canvas);
}

// A painted sign for shops and billboards: bold text on a flat colour.
export function buildSignTexture(text, background, foreground) {
  const { canvas, ctx } = makeCanvas(512, 128);
  ctx.fillStyle = background;
  ctx.fillRect(0, 0, 512, 128);
  ctx.fillStyle = foreground;
  ctx.font = 'bold 64px Arial, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, 256, 68);
  return toTexture(canvas);
}
