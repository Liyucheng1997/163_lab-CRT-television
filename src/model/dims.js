// 全局尺寸（1 单位 ≈ 11 cm）。所有建模模块共享这些数值，保证显像管、外壳、电子束对齐。

export const FLOOR_Y = -1.45;

// 屏幕（显像管面板）中心
export const SX = -0.55;
export const SY = 0.35;

// 木质外壳套筒
export const CAB = {
  left: -2.3,
  right: 2.3,
  bottom: -1.2,
  top: 1.8,
  front: 1.3,
  back: -0.6,
  wall: 0.12,
};

// 前面板（塑料面框）
export const BEZEL = {
  left: -2.18,
  right: 2.18,
  bottom: -1.08,
  top: 1.68,
  frontZ: 1.27,
  backZ: 1.2,
};

// 显像管玻屏：超椭圆轮廓 + 球面曲率
export const FACE = {
  a: 1.46,
  b: 1.12,
  n: 4.6,
  apexZ: 1.15,
  radius: 7.2,
  skirtZ: 0.78,
};

// 面框开口（可见区域）
export const HOLE = { a: 1.37, b: 1.03, n: 5.2 };

// 扫描光栅（略大于可见区域，模拟过扫描）
export const RASTER = { halfW: 1.42, halfH: 1.065 };

export const NECK = {
  r: 0.165,
  startZ: -0.72,
  endZ: -2.02,
};

export const GUN = {
  cathodeZ: -1.84,
  exitZ: -1.12,
};

export const YOKE = {
  backZ: -0.86,
  centerZ: -0.5,
  frontZ: -0.3,
};

export const PCB = {
  y: -0.97,
  thickness: 0.03,
  minX: -1.72,
  maxX: 1.72,
  minZ: -1.15,
  maxZ: 0.66,
};

export const PANEL = {
  left: 1.0,
  right: 2.06,
  bottom: -0.96,
  top: 1.56,
  z: 1.27,
};

export const ANTENNA = { x: -0.95, z: -0.18 };

export function faceZ(x, y) {
  const dx = x - SX;
  const dy = y - SY;
  return FACE.apexZ - (dx * dx + dy * dy) / (2 * FACE.radius);
}

// 锥体轮廓：t=0 在管颈，t=1 在屏裙。sin^p 曲线让两端都平滑过渡。
export function funnelScale(t) {
  return Math.pow(Math.sin((t * Math.PI) / 2), 1.6);
}

export function funnelStation(t) {
  const s = funnelScale(t);
  return {
    z: NECK.startZ + (FACE.skirtZ - NECK.startZ) * t,
    a: NECK.r + (FACE.a - NECK.r) * s,
    b: NECK.r + (FACE.b - NECK.r) * s,
    n: 2 + (FACE.n - 2) * Math.pow(t, 1.7),
    cx: SX,
    cy: SY,
  };
}
