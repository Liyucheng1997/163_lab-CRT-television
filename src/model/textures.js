import * as THREE from 'three';
import { mulberry32 } from './utils.js';
import { PANEL } from './dims.js';

const FONT = '"Microsoft YaHei", "PingFang SC", "Noto Sans CJK SC", "Source Han Sans SC", sans-serif';

function makeCanvas(w, h) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  return c;
}

function toTexture(canvas, { srgb = true, repeat = false, anisotropy = 8 } = {}) {
  const t = new THREE.CanvasTexture(canvas);
  if (srgb) t.colorSpace = THREE.SRGBColorSpace;
  if (repeat) t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.anisotropy = anisotropy;
  return t;
}

// 简单值噪声
function createNoise(seed) {
  const rand = mulberry32(seed);
  const size = 256;
  const table = new Float32Array(size * size);
  for (let i = 0; i < table.length; i += 1) table[i] = rand();
  const at = (x, y) => table[(y & (size - 1)) * size + (x & (size - 1))];
  const noise = (x, y) => {
    const xi = Math.floor(x);
    const yi = Math.floor(y);
    const xf = x - xi;
    const yf = y - yi;
    const u = xf * xf * (3 - 2 * xf);
    const v = yf * yf * (3 - 2 * yf);
    const a = at(xi, yi);
    const b = at(xi + 1, yi);
    const c = at(xi, yi + 1);
    const d = at(xi + 1, yi + 1);
    return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
  };
  const fbm = (x, y, oct = 4) => {
    let sum = 0;
    let amp = 0.5;
    let f = 1;
    for (let i = 0; i < oct; i += 1) {
      sum += noise(x * f, y * f) * amp;
      f *= 2.03;
      amp *= 0.5;
    }
    return sum;
  };
  return { noise, fbm };
}

/** 胡桃木贴皮：沿 u 方向的木纹，返回颜色贴图与凹凸贴图 */
export function createWoodTextures() {
  const w = 1024;
  const h = 512;
  const color = makeCanvas(w, h);
  const bump = makeCanvas(w, h);
  const cctx = color.getContext('2d');
  const bctx = bump.getContext('2d');
  const cImg = cctx.createImageData(w, h);
  const bImg = bctx.createImageData(w, h);
  const { noise, fbm } = createNoise(7);
  const dark = [46, 29, 19];
  const mid = [78, 50, 32];
  const light = [108, 72, 46];

  for (let y = 0; y < h; y += 1) {
    for (let x = 0; x < w; x += 1) {
      // 轻微弯曲的平行木纹（径切胡桃木）
      const warp = fbm(x * 0.0018, y * 0.008, 3) * 2.4 + fbm(x * 0.0006, y * 0.0025, 2) * 3.2;
      const ring = y * 0.07 + warp;
      const band = 0.5 + 0.5 * Math.sin(ring * Math.PI * 2 * 0.5);
      const g = Math.pow(band, 1.6);
      const streak = noise(x * 0.012, y * 0.6);
      const fine = noise(x * 0.6, y * 0.05);
      const pores = noise(x * 0.3, y * 1.6) > 0.88 ? 0.7 : 1;
      const figure = 0.88 + 0.24 * fbm(x * 0.006, y * 0.05, 3);
      const t = Math.min(1, Math.max(0, (g * 0.55 + streak * 0.3 + fine * 0.15) * figure));
      const base = t < 0.5 ? lerp3(dark, mid, t * 2) : lerp3(mid, light, (t - 0.5) * 2);
      const i = (y * w + x) * 4;
      cImg.data[i] = base[0] * pores;
      cImg.data[i + 1] = base[1] * pores;
      cImg.data[i + 2] = base[2] * pores;
      cImg.data[i + 3] = 255;
      const bv = 150 + (g - 0.5) * 30 + (streak - 0.5) * 30 + (fine - 0.5) * 30 - (pores < 1 ? 60 : 0);
      bImg.data[i] = bImg.data[i + 1] = bImg.data[i + 2] = bv;
      bImg.data[i + 3] = 255;
    }
  }
  cctx.putImageData(cImg, 0, 0);
  bctx.putImageData(bImg, 0, 0);
  const map = toTexture(color, { repeat: true });
  const bumpMap = toTexture(bump, { srgb: false, repeat: true });
  for (const t of [map, bumpMap]) t.repeat.set(0.22, 0.3);
  return { map, bumpMap };
}

function lerp3(a, b, t) {
  return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
}

/** 拉丝金属：用于粗糙度/凹凸 */
export function createBrushedTexture(seed = 3) {
  const w = 512;
  const h = 512;
  const c = makeCanvas(w, h);
  const ctx = c.getContext('2d');
  const rand = mulberry32(seed);
  ctx.fillStyle = '#808080';
  ctx.fillRect(0, 0, w, h);
  for (let i = 0; i < 2600; i += 1) {
    const y = rand() * h;
    const v = 90 + rand() * 80;
    ctx.fillStyle = `rgba(${v},${v},${v},${0.18 + rand() * 0.3})`;
    ctx.fillRect(rand() * w - 100, y, 60 + rand() * 420, 0.6 + rand() * 1.2);
  }
  const t = toTexture(c, { srgb: false, repeat: true });
  return t;
}

/** 铝制控制面板：拉丝底 + 丝印文字、频道刻度 */
export function createPanelTexture(layout) {
  const pw = PANEL.right - PANEL.left;
  const ph = PANEL.top - PANEL.bottom;
  const scale = 480;
  const w = Math.round(pw * scale);
  const h = Math.round(ph * scale);
  const c = makeCanvas(w, h);
  const ctx = c.getContext('2d');
  const rand = mulberry32(11);

  const grad = ctx.createLinearGradient(0, 0, w, h);
  grad.addColorStop(0, '#d3d5d6');
  grad.addColorStop(0.5, '#c3c6c8');
  grad.addColorStop(1, '#cfd1d2');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, w, h);
  for (let i = 0; i < 2200; i += 1) {
    const v = 170 + rand() * 70;
    ctx.fillStyle = `rgba(${v},${v},${v + 3},${0.12 + rand() * 0.25})`;
    ctx.fillRect(rand() * w - 60, rand() * h, 40 + rand() * w * 0.6, 0.7 + rand());
  }

  const px = (x) => (x - PANEL.left) * scale;
  const py = (y) => (PANEL.top - y) * scale;
  const ink = '#1d2023';

  // 顶部品牌条
  ctx.fillStyle = '#1b1d20';
  ctx.fillRect(0, 0, w, 0.16 * scale);
  ctx.fillStyle = '#e9e2cf';
  ctx.font = `bold ${0.075 * scale}px ${FONT}`;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  ctx.fillText('晨光', 0.07 * scale, 0.08 * scale);
  ctx.font = `${0.04 * scale}px ${FONT}`;
  ctx.textAlign = 'right';
  ctx.fillText('TV-14B  黑白电视机', w - 0.06 * scale, 0.08 * scale);
  ctx.fillStyle = '#b8322a';
  ctx.fillRect(0, 0.16 * scale, w, 0.012 * scale);

  // 频道刻度盘
  const ch = layout.channel;
  ctx.save();
  ctx.translate(px(ch.x), py(ch.y));
  ctx.strokeStyle = ink;
  ctx.fillStyle = ink;
  ctx.lineWidth = 0.005 * scale;
  ctx.beginPath();
  ctx.arc(0, 0, (ch.r + 0.045) * scale, 0, Math.PI * 2);
  ctx.stroke();
  ctx.font = `bold ${0.052 * scale}px ${FONT}`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  for (let i = 0; i < 12; i += 1) {
    const a = -Math.PI / 2 + (i / 12) * Math.PI * 2;
    const r1 = (ch.r + 0.045) * scale;
    const r2 = (ch.r + 0.07) * scale;
    ctx.beginPath();
    ctx.moveTo(Math.cos(a) * r1, Math.sin(a) * r1);
    ctx.lineTo(Math.cos(a) * r2, Math.sin(a) * r2);
    ctx.stroke();
    const rt = (ch.r + 0.115) * scale;
    ctx.fillText(String(i + 1), Math.cos(a) * rt, Math.sin(a) * rt);
  }
  ctx.restore();
  ctx.font = `${0.04 * scale}px ${FONT}`;
  ctx.textAlign = 'center';
  ctx.fillStyle = ink;
  ctx.fillText('频道  CHANNEL', px(ch.x), py(ch.y - ch.r - 0.2));

  // 小旋钮刻度
  for (const k of layout.small) {
    ctx.save();
    ctx.translate(px(k.x), py(k.y));
    ctx.strokeStyle = ink;
    ctx.lineWidth = 0.004 * scale;
    for (let i = 0; i <= 10; i += 1) {
      const a = Math.PI * 0.75 + (i / 10) * Math.PI * 1.5;
      const r1 = (k.r + 0.03) * scale;
      const r2 = (k.r + (i % 5 === 0 ? 0.058 : 0.045)) * scale;
      ctx.beginPath();
      ctx.moveTo(Math.cos(a) * r1, Math.sin(a) * r1);
      ctx.lineTo(Math.cos(a) * r2, Math.sin(a) * r2);
      ctx.stroke();
    }
    ctx.restore();
    ctx.fillStyle = ink;
    ctx.font = `${0.036 * scale}px ${FONT}`;
    ctx.textAlign = 'center';
    ctx.fillText(k.label, px(k.x), py(k.y - k.r - 0.09));
  }

  // 电源开关标注
  const pwr = layout.power;
  ctx.fillStyle = ink;
  ctx.font = `${0.036 * scale}px ${FONT}`;
  ctx.fillText('电源', px(pwr.x), py(pwr.y - pwr.r - 0.09));
  ctx.strokeStyle = ink;
  ctx.lineWidth = 0.004 * scale;
  ctx.beginPath();
  ctx.arc(px(pwr.x), py(pwr.y), (pwr.r + 0.03) * scale, 0, Math.PI * 2);
  ctx.stroke();

  // 喇叭网区域下沉阴影
  const g = layout.grille;
  ctx.fillStyle = 'rgba(20,22,24,0.85)';
  ctx.fillRect(px(g.x0) - 4, py(g.y1) - 4, (g.x1 - g.x0) * scale + 8, (g.y1 - g.y0) * scale + 8);

  const map = toTexture(c);
  map.repeat.set(1 / pw, 1 / ph);
  map.offset.set(-PANEL.left / pw, -PANEL.bottom / ph);
  return map;
}

/** 冲孔喇叭网：alpha 贴图（白=实体，黑=孔） */
export function createGrilleAlpha(holeSpacing, width, height) {
  const tile = 64;
  const th = Math.round(tile * Math.sqrt(3));
  const c = makeCanvas(tile, th);
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#fff';
  ctx.fillRect(0, 0, tile, th);
  ctx.fillStyle = '#000';
  const r = tile * 0.3;
  const holes = [
    [0, 0],
    [tile, 0],
    [tile / 2, th / 2],
    [0, th],
    [tile, th],
  ];
  for (const [x, y] of holes) {
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
  }
  const t = toTexture(c, { srgb: false, repeat: true });
  t.repeat.set(width / holeSpacing, height / (holeSpacing * Math.sqrt(3)));
  return t;
}

/** 酚醛纸基电路板（元件面） */
export function createPcbTexture(widthUnits, depthUnits) {
  const scale = 256;
  const w = Math.round(widthUnits * scale);
  const h = Math.round(depthUnits * scale);
  const c = makeCanvas(w, h);
  const ctx = c.getContext('2d');
  const rand = mulberry32(21);
  ctx.fillStyle = '#9a7041';
  ctx.fillRect(0, 0, w, h);
  for (let i = 0; i < 900; i += 1) {
    const v = rand();
    ctx.fillStyle = `rgba(${90 + v * 60},${60 + v * 40},${30 + v * 20},0.12)`;
    ctx.fillRect(rand() * w, rand() * h, 6 + rand() * 40, 2 + rand() * 18);
  }
  ctx.strokeStyle = 'rgba(245,240,225,0.55)';
  ctx.fillStyle = 'rgba(245,240,225,0.6)';
  ctx.lineWidth = 1.4;
  ctx.font = `10px ${FONT}`;
  for (let i = 0; i < 160; i += 1) {
    const x = rand() * w;
    const y = rand() * h;
    if (rand() < 0.5) {
      ctx.strokeRect(x, y, 10 + rand() * 26, 6 + rand() * 10);
    } else {
      ctx.beginPath();
      ctx.arc(x, y, 5 + rand() * 9, 0, Math.PI * 2);
      ctx.stroke();
    }
    if (rand() < 0.45) ctx.fillText(`${'RCVQTL'[Math.floor(rand() * 6)]}${Math.floor(rand() * 600)}`, x + 2, y - 3);
  }
  ctx.fillStyle = 'rgba(40,30,20,0.85)';
  for (let i = 0; i < 1400; i += 1) {
    ctx.beginPath();
    ctx.arc(rand() * w, rand() * h, 1.3, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.fillStyle = 'rgba(245,240,225,0.7)';
  ctx.font = `bold 22px ${FONT}`;
  ctx.fillText('TV-14B  主板  1983', w * 0.06, h * 0.93);
  return toTexture(c);
}

/** 后盖警告贴纸 */
export function createStickerTexture() {
  const w = 512;
  const h = 320;
  const c = makeCanvas(w, h);
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#e8dfc4';
  ctx.fillRect(0, 0, w, h);
  ctx.strokeStyle = '#2a2622';
  ctx.lineWidth = 6;
  ctx.strokeRect(10, 10, w - 20, h - 20);
  // 警告三角
  ctx.fillStyle = '#d8b21f';
  ctx.beginPath();
  ctx.moveTo(70, 40);
  ctx.lineTo(120, 128);
  ctx.lineTo(20, 128);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = '#1a1714';
  ctx.lineWidth = 5;
  ctx.stroke();
  ctx.fillStyle = '#1a1714';
  ctx.font = `bold 58px ${FONT}`;
  ctx.textAlign = 'center';
  ctx.fillText('!', 70, 120);
  ctx.textAlign = 'left';
  ctx.fillStyle = '#b8261d';
  ctx.font = `bold 44px ${FONT}`;
  ctx.fillText('注 意', 145, 82);
  ctx.fillStyle = '#1a1714';
  ctx.font = `24px ${FONT}`;
  ctx.fillText('机内有高压，非专业人员', 145, 120);
  ctx.fillText('请勿打开后盖', 145, 150);
  ctx.font = `21px ${FONT}`;
  ctx.fillText('型号：TV-14B   35 cm 黑白电视接收机', 30, 200);
  ctx.fillText('电源：~220V 50Hz   功耗：32W', 30, 232);
  ctx.fillText('出厂编号：830417    检验 合格', 30, 264);
  const rand = mulberry32(5);
  for (let i = 0; i < 400; i += 1) {
    ctx.fillStyle = `rgba(110,90,60,${rand() * 0.08})`;
    ctx.fillRect(rand() * w, rand() * h, 2 + rand() * 30, 1 + rand() * 10);
  }
  return toTexture(c);
}

/** 铜漆包线绕组纹理 */
export function createWindingTexture() {
  const w = 256;
  const h = 256;
  const c = makeCanvas(w, h);
  const ctx = c.getContext('2d');
  const rand = mulberry32(17);
  for (let x = 0; x < w; x += 4) {
    const v = 150 + rand() * 60;
    ctx.fillStyle = `rgb(${v},${v},${v})`;
    ctx.fillRect(x, 0, 3, h);
    ctx.fillStyle = 'rgb(60,60,60)';
    ctx.fillRect(x + 3, 0, 1, h);
  }
  return toTexture(c, { srgb: false, repeat: true });
}

/** 色环电阻 */
export function createResistorTexture() {
  const c = makeCanvas(16, 128);
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, 16, 128);
  const bands = [
    [30, '#6b3b1c'],
    [46, '#141414'],
    [62, '#c23322'],
    [92, '#c8a24a'],
  ];
  for (const [y, col] of bands) {
    ctx.fillStyle = col;
    ctx.fillRect(0, y, 16, 9);
  }
  return toTexture(c);
}

/** 电解电容套管 */
export function createCapSleeveTexture() {
  const c = makeCanvas(256, 64);
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#7a7a7a';
  ctx.fillRect(0, 0, 256, 64);
  ctx.fillStyle = '#e6e6e6';
  ctx.fillRect(0, 0, 36, 64);
  ctx.fillStyle = '#3c3c3c';
  for (let y = 6; y < 64; y += 14) ctx.fillRect(12, y, 12, 4);
  ctx.fillStyle = '#d8d8d8';
  ctx.font = `bold 13px ${FONT}`;
  ctx.fillText('470μF 25V', 70, 36);
  return toTexture(c);
}

/** 后盖散热槽 alpha（uv.x 周长，uv.y 长度） */
export function createVentAlpha() {
  const w = 2048;
  const h = 512;
  const c = makeCanvas(w, h);
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#fff';
  ctx.fillRect(0, 0, w, h);
  ctx.fillStyle = '#000';
  const slot = (u0, u1, v0, v1, pitch, width) => {
    for (let u = u0; u <= u1; u += pitch) {
      const x = u * w;
      const y0 = (1 - v1) * h;
      const y1 = (1 - v0) * h;
      roundRect(ctx, x - (width * w) / 2, y0, width * w, y1 - y0, (width * w) / 2);
    }
  };
  // 顶部（u≈0.25）与两侧（u≈0、0.5）散热槽
  slot(0.17, 0.33, 0.42, 0.58, 0.0075, 0.0034);
  slot(0.17, 0.33, 0.64, 0.8, 0.0075, 0.0034);
  slot(0.44, 0.56, 0.5, 0.74, 0.0075, 0.0034);
  slot(0.94, 1.0, 0.5, 0.74, 0.0075, 0.0034);
  slot(0.0, 0.06, 0.5, 0.74, 0.0075, 0.0034);
  const t = toTexture(c, { srgb: false });
  return t;
}

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.fill();
}

/** 镀铬字标 alpha */
export function createBadgeAlpha(text) {
  const c = makeCanvas(512, 96);
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#000';
  ctx.fillRect(0, 0, 512, 96);
  ctx.fillStyle = '#fff';
  ctx.font = `italic bold 62px Georgia, "Times New Roman", serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, 256, 52);
  return toTexture(c, { srgb: false });
}

/** 塑料细颗粒（凹凸） */
export function createGrainTexture(seed = 9) {
  const s = 256;
  const c = makeCanvas(s, s);
  const ctx = c.getContext('2d');
  const img = ctx.createImageData(s, s);
  const rand = mulberry32(seed);
  for (let i = 0; i < s * s; i += 1) {
    const v = 110 + rand() * 40;
    img.data[i * 4] = img.data[i * 4 + 1] = img.data[i * 4 + 2] = v;
    img.data[i * 4 + 3] = 255;
  }
  ctx.putImageData(img, 0, 0);
  return toTexture(c, { srgb: false, repeat: true });
}

/** 地面柔和接触阴影 */
export function createShadowTexture() {
  const c = makeCanvas(256, 256);
  const ctx = c.getContext('2d');
  const g = ctx.createRadialGradient(128, 128, 10, 128, 128, 128);
  g.addColorStop(0, 'rgba(0,0,0,0.75)');
  g.addColorStop(0.5, 'rgba(0,0,0,0.35)');
  g.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 256, 256);
  return toTexture(c);
}

/** 叠层硅钢片 */
export function createLaminationTexture() {
  const c = makeCanvas(64, 256);
  const ctx = c.getContext('2d');
  for (let y = 0; y < 256; y += 4) {
    const v = 70 + ((y / 4) % 2) * 18;
    ctx.fillStyle = `rgb(${v},${v + 2},${v + 4})`;
    ctx.fillRect(0, y, 64, 3);
    ctx.fillStyle = '#2a2c2e';
    ctx.fillRect(0, y + 3, 64, 1);
  }
  return toTexture(c, { repeat: true });
}
