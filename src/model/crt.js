import * as THREE from 'three';
import { FACE, NECK, RASTER, SX, SY, YOKE, faceZ, funnelStation } from './dims.js';
import { loftGeometry, superellipseRing, tube } from './utils.js';

const SEGMENTS = 192;

/** 某个 z 处锥体的平均半径（偏转线圈区域近似为圆） */
export function funnelRadiusAt(z) {
  if (z <= NECK.startZ) return NECK.r;
  const t = Math.min(1, (z - NECK.startZ) / (FACE.skirtZ - NECK.startZ));
  const st = funnelStation(t);
  return (st.a + st.b) / 2;
}

function funnelPoint(t, theta) {
  const st = funnelStation(t);
  const c = Math.cos(theta);
  const s = Math.sin(theta);
  const e = 2 / st.n;
  return new THREE.Vector3(
    st.cx + st.a * Math.sign(c) * Math.abs(c) ** e,
    st.cy + st.b * Math.sign(s) * Math.abs(s) ** e,
    st.z,
  );
}

export function buildCRT(m) {
  const group = new THREE.Group();
  group.name = 'crt';
  const parts = {};

  const tubeGroup = new THREE.Group();
  tubeGroup.name = '显像管';
  group.add(tubeGroup);
  parts.tube = tubeGroup;

  // —— 玻屏（球面） ——
  const faceGeo = createFaceplateGeometry();
  const screen = new THREE.Mesh(faceGeo, m.screen);
  screen.name = '荧光屏';
  tubeGroup.add(screen);
  parts.screen = screen;

  const screenBack = new THREE.Mesh(faceGeo, m.screenBack);
  screenBack.position.z = -0.045;
  tubeGroup.add(screenBack);

  // —— 锥体 + 屏裙 ——
  const stations = [];
  for (let i = 0; i <= 44; i += 1) {
    const t = Math.pow(i / 44, 1.25);
    stations.push(funnelStation(t));
  }
  stations.push({ zAt: (x, y) => faceZ(x, y) - 0.002, a: FACE.a, b: FACE.b, n: FACE.n, cx: SX, cy: SY });
  const funnel = new THREE.Mesh(loftGeometry(stations, SEGMENTS), m.aquadag);
  funnel.name = '锥体';
  tubeGroup.add(funnel);

  // —— 管颈玻璃 ——
  const neckStations = [
    { z: NECK.startZ + 0.02, a: NECK.r, b: NECK.r, n: 2, cx: SX, cy: SY },
    { z: NECK.endZ, a: NECK.r, b: NECK.r, n: 2, cx: SX, cy: SY },
    { z: NECK.endZ - 0.03, a: NECK.r * 0.95, b: NECK.r * 0.95, n: 2, cx: SX, cy: SY },
    { z: NECK.endZ - 0.055, a: NECK.r * 0.78, b: NECK.r * 0.78, n: 2, cx: SX, cy: SY },
    { z: NECK.endZ - 0.07, a: NECK.r * 0.45, b: NECK.r * 0.45, n: 2, cx: SX, cy: SY },
  ];
  const neck = new THREE.Mesh(loftGeometry(neckStations, 64, { capEnd: true }), m.glass);
  neck.renderOrder = 2;
  tubeGroup.add(neck);

  // —— 防爆箍 + 安装耳 ——
  const bandStations = [0.795, 0.8, 0.93, 0.935].map((z, i) => ({
    z,
    a: FACE.a + (i === 0 || i === 3 ? 0.004 : 0.016),
    b: FACE.b + (i === 0 || i === 3 ? 0.004 : 0.016),
    n: FACE.n,
    cx: SX,
    cy: SY,
  }));
  const band = new THREE.Mesh(loftGeometry(bandStations, SEGMENTS, { capStart: false }), m.steelCut);
  tubeGroup.add(band);
  for (const [sx, sy] of [
    [1, 1],
    [-1, 1],
    [1, -1],
    [-1, -1],
  ]) {
    const k = Math.pow(Math.SQRT1_2, 2 / FACE.n);
    const cx = SX + sx * (FACE.a + 0.016) * k;
    const cy = SY + sy * (FACE.b + 0.016) * k;
    const ear = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.085, 0.012), m.steelCut);
    ear.position.set(cx + sx * 0.07, cy + sy * 0.055, 0.865);
    ear.rotation.z = Math.atan2(sy * 0.75, sx);
    tubeGroup.add(ear);
    const boss = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.045, 1.2 - 0.87, 16), m.bezel);
    boss.rotation.x = Math.PI / 2;
    boss.position.set(cx + sx * 0.12, cy + sy * 0.09, (1.2 + 0.87) / 2);
    tubeGroup.add(boss);
    const bolt = new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.022, 0.03, 6), m.steelCut);
    bolt.rotation.x = Math.PI / 2;
    bolt.position.set(boss.position.x, boss.position.y, 0.845);
    tubeGroup.add(bolt);
  }

  // —— 阳极帽 + 高压线 ——
  const anode = buildAnodeCap(m);
  tubeGroup.add(anode.group);
  parts.anodeAnchor = anode.cableStart;

  // —— 石墨层接地弹簧线 ——
  const strapPts = superellipseRing(1, 1, 2, 72).map(([c, s]) => {
    const p = funnelPoint(0.5, Math.atan2(s, c));
    const dir = new THREE.Vector3(p.x - SX, p.y - SY, 0).normalize();
    return p.addScaledVector(dir, 0.012);
  });
  tubeGroup.add(tube(strapPts, 0.0065, m.steelCut, { segments: 300, radial: 6, closed: true }));

  const gun = buildGun(m);
  group.add(gun);
  parts.gun = gun;

  const yoke = buildYoke(m);
  group.add(yoke);
  parts.yoke = yoke;

  return { group, parts };
}

function createFaceplateGeometry() {
  const rings = 30;
  const boundary = superellipseRing(FACE.a, FACE.b, FACE.n, SEGMENTS);
  const positions = [];
  const uvs = [];
  const pushVertex = (x, y) => {
    positions.push(x, y, faceZ(x, y));
    uvs.push((x - SX) / (2 * RASTER.halfW) + 0.5, (y - SY) / (2 * RASTER.halfH) + 0.5);
  };
  pushVertex(SX, SY);
  for (let i = 1; i <= rings; i += 1) {
    const r = i / rings;
    for (let j = 0; j <= SEGMENTS; j += 1) {
      const [bx, by] = boundary[j % SEGMENTS];
      pushVertex(SX + bx * r, SY + by * r);
    }
  }
  const indices = [];
  const row = SEGMENTS + 1;
  for (let j = 0; j < SEGMENTS; j += 1) indices.push(0, 1 + j, 2 + j);
  for (let i = 1; i < rings; i += 1) {
    const base = 1 + (i - 1) * row;
    for (let j = 0; j < SEGMENTS; j += 1) {
      const a = base + j;
      const b = a + 1;
      const c = a + row;
      const d = c + 1;
      indices.push(a, c, b, b, c, d);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  g.setIndex(indices);
  g.computeVertexNormals();
  return g;
}

function buildAnodeCap(m) {
  const group = new THREE.Group();
  group.name = '高压阳极帽';
  const t = 0.6;
  const theta = THREE.MathUtils.degToRad(118);
  const p = funnelPoint(t, theta);
  const pT = funnelPoint(t + 0.01, theta);
  const pA = funnelPoint(t, theta + 0.01);
  const normal = new THREE.Vector3()
    .crossVectors(pA.clone().sub(p), pT.clone().sub(p))
    .normalize();
  if (normal.dot(new THREE.Vector3(p.x - SX, p.y - SY, 0)) < 0) normal.negate();

  const cup = new THREE.Mesh(
    new THREE.LatheGeometry(
      [
        [0, 0.07],
        [0.03, 0.068],
        [0.05, 0.055],
        [0.085, 0.025],
        [0.115, 0.004],
        [0.118, 0],
      ].map(([x, y]) => new THREE.Vector2(x, y)),
      48,
    ),
    m.rubber,
  );
  const quat = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), normal);
  cup.quaternion.copy(quat);
  cup.position.copy(p).addScaledVector(normal, -0.004);
  group.add(cup);
  const cableStart = p.clone().addScaledVector(normal, 0.065);
  return { group, cableStart, normal };
}

function buildGun(m) {
  const group = new THREE.Group();
  group.name = '电子枪';
  const axial = (r, z0, z1, mat, segs = 32, open = false) => {
    const mesh = new THREE.Mesh(new THREE.CylinderGeometry(r, r, Math.abs(z1 - z0), segs, 1, open), mat);
    mesh.rotation.x = Math.PI / 2;
    mesh.position.set(SX, SY, (z0 + z1) / 2);
    group.add(mesh);
    return mesh;
  };

  // 阴极与灯丝（灯丝发出橙光）
  axial(0.012, -1.96, -1.9, m.heater, 12);
  axial(0.024, -1.92, -1.835, m.nickel);
  // G1 / G2 / G3（聚焦极）/ G4（阳极）/ 屏蔽杯
  axial(0.056, -1.85, -1.805, m.nickel);
  axial(0.058, -1.795, -1.76, m.nickel);
  axial(0.086, -1.735, -1.44, m.nickel, 40);
  axial(0.09, -1.445, -1.43, m.nickel, 40);
  axial(0.086, -1.395, -1.2, m.nickel, 40);
  axial(0.09, -1.405, -1.39, m.nickel, 40);
  axial(0.112, -1.18, -1.1, m.nickel, 40);

  // 玻璃支撑杆 + 焊片
  for (const side of [-1, 1]) {
    const rod = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.034, 0.86), m.bead);
    rod.position.set(SX + side * 0.118, SY, -1.53);
    group.add(rod);
    for (const z of [-1.89, -1.83, -1.78, -1.7, -1.5, -1.36, -1.25, -1.14]) {
      const strap = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.012, 0.014), m.nickel);
      strap.position.set(SX + side * 0.095, SY, z);
      group.add(strap);
    }
  }

  // 防打火弹簧片（接触管颈内壁石墨层）
  for (let i = 0; i < 3; i += 1) {
    const a = (i / 3) * Math.PI * 2 + Math.PI / 2;
    const spring = new THREE.Mesh(new THREE.BoxGeometry(0.014, 0.004, 0.1), m.nickel);
    spring.position.set(SX + Math.cos(a) * 0.135, SY + Math.sin(a) * 0.135, -1.06);
    spring.rotation.z = a;
    spring.rotateX(-0.35);
    group.add(spring);
  }

  // 芯柱引脚
  for (let i = 0; i < 8; i += 1) {
    const a = (i / 8) * Math.PI * 2;
    const pin = new THREE.Mesh(new THREE.CylinderGeometry(0.006, 0.006, 0.22, 6), m.lead);
    pin.rotation.x = Math.PI / 2;
    pin.position.set(SX + Math.cos(a) * 0.085, SY + Math.sin(a) * 0.085, NECK.endZ - 0.06);
    group.add(pin);
    if (i % 2 === 0) {
      const targetZ = [-1.88, -1.82, -1.7, -1.3][i / 2];
      const wire = tube(
        [
          new THREE.Vector3(SX + Math.cos(a) * 0.085, SY + Math.sin(a) * 0.085, NECK.endZ + 0.04),
          new THREE.Vector3(SX + Math.cos(a) * 0.1, SY + Math.sin(a) * 0.1, (NECK.endZ + targetZ) / 2),
          new THREE.Vector3(SX + Math.cos(a) * 0.075, SY + Math.sin(a) * 0.075, targetZ),
        ],
        0.0035,
        m.lead,
        { segments: 16, radial: 4 },
      );
      group.add(wire);
    }
  }

  // 管座 + 管座板
  const socket = new THREE.Mesh(new THREE.CylinderGeometry(0.19, 0.2, 0.12, 40), m.blackPlastic);
  socket.rotation.x = Math.PI / 2;
  socket.position.set(SX, SY, NECK.endZ - 0.15);
  group.add(socket);
  for (let i = 0; i < 12; i += 1) {
    const a = (i / 12) * Math.PI * 2;
    const rib = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.02, 0.11), m.blackPlastic);
    rib.position.set(SX + Math.cos(a) * 0.2, SY + Math.sin(a) * 0.2, NECK.endZ - 0.15);
    rib.rotation.z = a;
    group.add(rib);
  }
  const board = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.46, 0.022), m.pcbGreen);
  board.position.set(SX, SY - 0.02, NECK.endZ - 0.225);
  group.add(board);
  const rand = mulberryLocal(4);
  for (let i = 0; i < 9; i += 1) {
    const x = SX - 0.19 + rand() * 0.38;
    const y = SY - 0.22 + rand() * 0.4;
    if (Math.hypot(x - SX, y - SY) < 0.13) continue;
    const r = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.07, 10), m.resistor);
    r.rotation.z = Math.PI / 2 + (rand() > 0.5 ? Math.PI / 2 : 0);
    r.position.set(x, y, NECK.endZ - 0.25);
    group.add(r);
  }

  // 灯丝辉光
  const glow = new THREE.PointLight(0xff8a3a, 0.35, 0.6, 2);
  glow.position.set(SX, SY, -1.9);
  group.add(glow);
  return group;
}

function mulberryLocal(seed) {
  let s = seed;
  return () => {
    s = (s * 16807) % 2147483647;
    return s / 2147483647;
  };
}

function lathe(profile, mat, segments = 96, phiStart = 0, phiLength = Math.PI * 2) {
  const g = new THREE.LatheGeometry(
    profile.map(([r, z]) => new THREE.Vector2(r, z)),
    segments,
    phiStart,
    phiLength,
  );
  const mesh = new THREE.Mesh(g, mat);
  mesh.rotation.x = Math.PI / 2;
  mesh.position.set(SX, SY, 0);
  return mesh;
}

function buildYoke(m) {
  const group = new THREE.Group();
  group.name = '偏转线圈';
  const r = funnelRadiusAt;

  // 塑料骨架（贴合锥体，前端外翻）
  const liner = [];
  const zs = [];
  for (let i = 0; i <= 14; i += 1) zs.push(YOKE.backZ + ((YOKE.frontZ - YOKE.backZ) * i) / 14);
  for (const z of zs) liner.push([r(z) + 0.01, z]);
  liner.push([r(YOKE.frontZ) + 0.2, YOKE.frontZ + 0.01]);
  liner.push([r(YOKE.frontZ) + 0.2, YOKE.frontZ - 0.015]);
  for (const z of [...zs].reverse()) liner.push([r(z) + 0.028, z - 0.02]);
  liner.push([r(YOKE.backZ) + 0.01, YOKE.backZ]);
  group.add(lathe(liner, m.yokePlastic, 128));

  // 行偏转鞍形线圈（上下两组），贴着骨架内侧
  // lathe 的 φ 与 xy 平面角 α 的关系：α = φ - π/2；鞍形线圈位于上下（α≈π/2、3π/2）
  for (const start of [Math.PI * 0.56, Math.PI * 1.56]) {
    const len = Math.PI * 0.88;
    const body = [];
    const zb = [];
    for (let i = 0; i <= 12; i += 1) zb.push(-0.8 + (0.44 * i) / 12);
    for (const z of zb) body.push([r(z) + 0.03, z]);
    for (const z of [...zb].reverse()) body.push([r(z) + 0.065, z]);
    body.push([r(zb[0]) + 0.03, zb[0]]);
    group.add(lathe(body, m.copper, 96, start, len));
    // 前后端部线包（外翻的“鞍”）
    for (const [z, rr, tubeR] of [
      [-0.345, r(-0.345) + 0.1, 0.042],
      [-0.8, r(-0.8) + 0.07, 0.034],
    ]) {
      const t = new THREE.Mesh(new THREE.TorusGeometry(rr, tubeR, 14, 64, len), m.copper);
      t.position.set(SX, SY, z);
      t.rotation.z = start - Math.PI / 2;
      t.scale.z = 0.8;
      group.add(t);
    }
  }

  // 铁氧体磁环
  const ferrite = [];
  const zf = [];
  for (let i = 0; i <= 8; i += 1) zf.push(-0.68 + (0.26 * i) / 8);
  for (const z of zf) ferrite.push([r(z) + 0.09, z]);
  for (const z of [...zf].reverse()) ferrite.push([r(z) + 0.17, z]);
  ferrite.push([r(zf[0]) + 0.09, zf[0]]);
  group.add(lathe(ferrite, m.ferrite, 128));

  // 场偏转环形线圈（绕在磁环上，左右两组）
  for (const start of [Math.PI * 0.07, Math.PI * 1.07]) {
    const winding = [];
    const zw = [];
    for (let i = 0; i <= 8; i += 1) zw.push(-0.67 + (0.24 * i) / 8);
    winding.push([r(zw[0]) + 0.085, zw[0] - 0.012]);
    for (const z of zw) winding.push([r(z) + 0.185, z]);
    winding.push([r(zw[zw.length - 1]) + 0.085, zw[zw.length - 1] + 0.012]);
    winding.push([r(zw[0]) + 0.085, zw[0] - 0.012]);
    group.add(lathe(winding, m.copper, 80, start, Math.PI * 0.86));
  }

  // 尾部紧固卡箍
  const clampZ = YOKE.backZ - 0.03;
  const clamp = lathe(
    [
      [NECK.r + 0.004, clampZ - 0.04],
      [NECK.r + 0.02, clampZ - 0.04],
      [NECK.r + 0.02, clampZ + 0.04],
      [NECK.r + 0.004, clampZ + 0.04],
      [NECK.r + 0.004, clampZ - 0.04],
    ],
    m.steelCut,
    64,
  );
  group.add(clamp);
  const screw = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.018, 0.09, 12), m.steelCut);
  screw.position.set(SX + 0.02, SY + NECK.r + 0.05, clampZ);
  screw.rotation.z = Math.PI / 2;
  group.add(screw);

  // 中心调节磁环（两片，带拨片）
  for (const [z, ang] of [
    [-0.95, 0.4],
    [-0.985, -0.9],
  ]) {
    const ring = lathe(
      [
        [NECK.r + 0.006, z - 0.012],
        [NECK.r + 0.085, z - 0.012],
        [NECK.r + 0.085, z + 0.012],
        [NECK.r + 0.006, z + 0.012],
        [NECK.r + 0.006, z - 0.012],
      ],
      m.magnetRing,
      64,
    );
    group.add(ring);
    const tab = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.08, 0.02), m.magnetRing);
    tab.position.set(SX + Math.cos(ang) * (NECK.r + 0.11), SY + Math.sin(ang) * (NECK.r + 0.11), z);
    tab.rotation.z = ang + Math.PI / 2;
    group.add(tab);
  }

  return group;
}
