import * as THREE from 'three';
import { ANTENNA, BEZEL, CAB, HOLE, PANEL, SX, SY, faceZ } from './dims.js';
import {
  boxProjectUV,
  knobGeometry,
  loftGeometry,
  ribbon,
  roundedRectPoints,
  roundedRectShape,
  superellipseShape,
  tube,
} from './utils.js';
import {
  createBadgeAlpha,
  createGrilleAlpha,
  createPanelTexture,
  createStickerTexture,
  createVentAlpha,
} from './textures.js';

export const PANEL_LAYOUT = {
  channel: { x: 1.53, y: 0.98, r: 0.2 },
  small: [
    { x: 1.27, y: 0.36, r: 0.095, label: '音量', angle: 0.6 },
    { x: 1.79, y: 0.36, r: 0.095, label: '亮度', angle: -0.9 },
    { x: 1.27, y: -0.04, r: 0.095, label: '对比度', angle: 0.2 },
  ],
  power: { x: 1.79, y: -0.04, r: 0.075 },
  grille: { x0: 1.09, x1: 1.97, y0: -0.87, y1: -0.36 },
};

export function buildCabinet(m, cutPlanes) {
  const group = new THREE.Group();
  group.name = 'cabinet';
  const parts = {};

  parts.sleeve = buildSleeve(m);
  group.add(parts.sleeve);

  const front = buildFrontPlate(m);
  group.add(front);
  parts.bezel = front;

  const controls = buildControlPanel(m);
  group.add(controls);
  parts.controls = controls;

  const speaker = buildSpeaker(m);
  group.add(speaker);
  parts.speaker = speaker;

  parts.legs = buildLegs(m);
  group.add(parts.legs);

  parts.back = buildBackCover(m, cutPlanes);
  group.add(parts.back);

  parts.antenna = buildAntenna(m);
  group.add(parts.antenna);

  return { group, parts };
}

function buildSleeve(m) {
  const bevel = 0.022;
  const outer = new THREE.Shape(
    roundedRectPoints(CAB.left + bevel, CAB.bottom + bevel, CAB.right - bevel, CAB.top - bevel, 0.12, 8),
  );
  const inner = new THREE.Path(
    roundedRectPoints(BEZEL.left - bevel, BEZEL.bottom - bevel, BEZEL.right + bevel, BEZEL.top + bevel, 0.035, 4).reverse(),
  );
  outer.holes.push(inner);
  const depth = CAB.front - CAB.back - bevel * 2;
  const geometry = new THREE.ExtrudeGeometry(outer, {
    depth,
    bevelEnabled: true,
    bevelThickness: bevel,
    bevelSize: bevel,
    bevelSegments: 4,
    curveSegments: 8,
  });
  const g = boxProjectUV(geometry, 1);
  const mesh = new THREE.Mesh(g, m.wood);
  mesh.position.z = CAB.back + bevel;
  mesh.name = '胡桃木外壳';
  return mesh;
}

function buildFrontPlate(m) {
  const group = new THREE.Group();
  const bevel = 0.012;
  const shape = roundedRectShape(BEZEL.left, BEZEL.bottom, BEZEL.right, BEZEL.top, 0.05, 6);
  const holeOuter = superellipseShape(HOLE.a + 0.07, HOLE.b + 0.07, HOLE.n, SX, SY, 200, true);
  shape.holes.push(new THREE.Path(holeOuter));
  const g = PANEL_LAYOUT.grille;
  shape.holes.push(new THREE.Path(roundedRectPoints(g.x0, g.y0, g.x1, g.y1, 0.03, 4).reverse()));

  const plate = new THREE.Mesh(
    new THREE.ExtrudeGeometry(shape, {
      depth: BEZEL.frontZ - BEZEL.backZ - bevel * 2,
      bevelEnabled: true,
      bevelThickness: bevel,
      bevelSize: bevel * 0.6,
      bevelSegments: 3,
      curveSegments: 12,
    }),
    m.bezel,
  );
  plate.position.z = BEZEL.backZ + bevel;
  plate.name = '前面框';
  group.add(plate);

  // 屏幕开口内侧的斜面遮框，从面框一直延伸到玻屏
  const tunnelMat = m.bezel.clone();
  tunnelMat.side = THREE.DoubleSide;
  const tunnel = new THREE.Mesh(
    loftGeometry(
      [
        { z: BEZEL.frontZ - 0.004, a: HOLE.a + 0.068, b: HOLE.b + 0.068, n: HOLE.n, cx: SX, cy: SY },
        { z: BEZEL.backZ - 0.01, a: HOLE.a + 0.035, b: HOLE.b + 0.035, n: HOLE.n, cx: SX, cy: SY },
        { z: 1.11, a: HOLE.a + 0.008, b: HOLE.b + 0.008, n: HOLE.n, cx: SX, cy: SY },
        { zAt: (x, y) => faceZ(x, y) + 0.002, a: HOLE.a, b: HOLE.b, n: HOLE.n, cx: SX, cy: SY },
      ],
      220,
    ),
    tunnelMat,
  );
  group.add(tunnel);

  // 屏幕开口镀铬饰圈
  const ring = superellipseShape(HOLE.a + 0.072, HOLE.b + 0.072, HOLE.n, SX, SY, 220).map(
    (p) => new THREE.Vector3(p.x, p.y, BEZEL.frontZ + 0.004),
  );
  group.add(tube(ring, 0.011, m.chrome, { segments: 400, radial: 8, closed: true }));

  // 面框外沿镀铬压条
  const trimPts = roundedRectPoints(BEZEL.left + 0.01, BEZEL.bottom + 0.01, BEZEL.right - 0.01, BEZEL.top - 0.01, 0.045, 6).map(
    (p) => new THREE.Vector3(p.x, p.y, BEZEL.frontZ + 0.002),
  );
  group.add(tube(trimPts, 0.012, m.chrome, { segments: 300, radial: 8, closed: true }));

  // 镀铬字标
  const badgeMat = m.chrome.clone();
  badgeMat.alphaMap = createBadgeAlpha('Chenguang');
  badgeMat.alphaTest = 0.5;
  badgeMat.roughness = 0.12;
  const badge = new THREE.Mesh(new THREE.PlaneGeometry(0.78, 0.146), badgeMat);
  badge.position.set(SX, BEZEL.bottom + 0.19, BEZEL.frontZ + 0.006);
  group.add(badge);

  return group;
}

function buildControlPanel(m) {
  const group = new THREE.Group();
  group.name = '控制面板';
  const L = PANEL_LAYOUT;

  const shape = roundedRectShape(PANEL.left, PANEL.bottom, PANEL.right, PANEL.top, 0.04, 6);
  shape.holes.push(new THREE.Path(roundedRectPoints(L.grille.x0, L.grille.y0, L.grille.x1, L.grille.y1, 0.03, 4).reverse()));
  const panelMat = m.aluminum.clone();
  panelMat.map = createPanelTexture(L);
  panelMat.metalness = 0.82;
  const panel = new THREE.Mesh(
    new THREE.ExtrudeGeometry(shape, {
      depth: 0.016,
      bevelEnabled: true,
      bevelThickness: 0.005,
      bevelSize: 0.005,
      bevelSegments: 2,
      curveSegments: 8,
    }),
    panelMat,
  );
  panel.position.z = PANEL.z;
  group.add(panel);
  const faceZPanel = PANEL.z + 0.026;

  // 频道旋钮（大）
  const channel = makeKnob(m, L.channel.r, 0.17, 30, 0.07);
  channel.position.set(L.channel.x, L.channel.y, faceZPanel);
  channel.rotation.z = -Math.PI / 6;
  group.add(channel);
  // 旋钮后方的镀铬衬圈
  const bezelRing = new THREE.Mesh(new THREE.TorusGeometry(L.channel.r * 1.17, 0.012, 12, 64), m.chrome);
  bezelRing.position.set(L.channel.x, L.channel.y, faceZPanel + 0.006);
  group.add(bezelRing);

  for (const k of L.small) {
    const knob = makeKnob(m, k.r, 0.12, 24, 0.08);
    knob.position.set(k.x, k.y, faceZPanel);
    knob.rotation.z = k.angle;
    group.add(knob);
  }

  // 电源按键与指示灯
  const p = L.power;
  const collar = new THREE.Mesh(new THREE.CylinderGeometry(p.r * 1.12, p.r * 1.18, 0.02, 48), m.chrome);
  collar.rotation.x = Math.PI / 2;
  collar.position.set(p.x, p.y, faceZPanel + 0.01);
  group.add(collar);
  const btnGeo = new THREE.CylinderGeometry(p.r * 0.92, p.r * 0.92, 0.07, 48);
  const button = new THREE.Mesh(btnGeo, m.knob);
  button.rotation.x = Math.PI / 2;
  button.position.set(p.x, p.y, faceZPanel + 0.045);
  group.add(button);
  const btnCap = new THREE.Mesh(new THREE.CylinderGeometry(p.r * 0.7, p.r * 0.7, 0.004, 48), m.knobInsert);
  btnCap.rotation.x = Math.PI / 2;
  btnCap.position.set(p.x, p.y, faceZPanel + 0.082);
  group.add(btnCap);
  const lamp = new THREE.Mesh(new THREE.SphereGeometry(0.022, 24, 16, 0, Math.PI * 2, 0, Math.PI / 2), m.lamp);
  lamp.rotation.x = Math.PI / 2;
  lamp.position.set(p.x + 0.14, p.y + 0.11, faceZPanel);
  lamp.name = 'powerLamp';
  group.add(lamp);
  const lampRing = new THREE.Mesh(new THREE.TorusGeometry(0.026, 0.006, 8, 32), m.chrome);
  lampRing.position.copy(lamp.position);
  group.add(lampRing);

  // 冲孔喇叭网 + 喇叭布
  const gw = L.grille.x1 - L.grille.x0 + 0.03;
  const gh = L.grille.y1 - L.grille.y0 + 0.03;
  const grilleMat = m.grille.clone();
  grilleMat.alphaMap = createGrilleAlpha(0.038, gw, gh);
  const grille = new THREE.Mesh(new THREE.PlaneGeometry(gw, gh), grilleMat);
  grille.position.set((L.grille.x0 + L.grille.x1) / 2, (L.grille.y0 + L.grille.y1) / 2, PANEL.z + 0.004);
  group.add(grille);
  const cloth = new THREE.Mesh(new THREE.PlaneGeometry(gw, gh), m.cloth);
  cloth.position.set(grille.position.x, grille.position.y, BEZEL.backZ + 0.004);
  group.add(cloth);

  return group;
}

function makeKnob(m, radius, height, ridges, depth) {
  const knob = new THREE.Group();
  const body = new THREE.Mesh(knobGeometry({ radius, height, ridges, ridgeDepth: depth }), m.knob);
  body.rotation.x = Math.PI / 2;
  knob.add(body);
  const insert = new THREE.Mesh(new THREE.CylinderGeometry(radius * 0.72, radius * 0.72, 0.006, 64), m.knobInsert);
  insert.rotation.x = Math.PI / 2;
  insert.position.z = height + 0.002;
  knob.add(insert);
  const pointer = new THREE.Mesh(new THREE.BoxGeometry(radius * 0.09, radius * 0.62, 0.004), m.knobPointer);
  pointer.position.set(0, radius * 0.5, height + 0.006);
  knob.add(pointer);
  // 侧裙指示线
  const skirtMark = new THREE.Mesh(new THREE.BoxGeometry(radius * 0.08, radius * 0.16, height * 0.12), m.knobPointer);
  skirtMark.position.set(0, radius * 1.1, height * 0.06);
  knob.add(skirtMark);
  return knob;
}

function buildSpeaker(m) {
  const g = PANEL_LAYOUT.grille;
  const group = new THREE.Group();
  group.name = '扬声器';
  const cone = new THREE.Group();
  const coneGeo = new THREE.LatheGeometry(
    [
      [0.05, -0.11],
      [0.08, -0.085],
      [0.14, -0.05],
      [0.2, -0.018],
      [0.235, -0.004],
      [0.25, 0],
    ].map(([x, y]) => new THREE.Vector2(x, y)),
    64,
  );
  const coneMesh = new THREE.Mesh(coneGeo, m.paper);
  coneMesh.rotation.x = Math.PI / 2;
  cone.add(coneMesh);
  const dust = new THREE.Mesh(new THREE.SphereGeometry(0.06, 32, 12, 0, Math.PI * 2, 0, Math.PI / 2.6), m.paper);
  dust.rotation.x = Math.PI / 2;
  dust.position.z = -0.12;
  cone.add(dust);
  const surround = new THREE.Mesh(new THREE.TorusGeometry(0.255, 0.012, 8, 64), m.paper);
  cone.add(surround);
  const frame = new THREE.Mesh(new THREE.TorusGeometry(0.27, 0.008, 6, 64), m.steel);
  frame.scale.z = 0.5;
  cone.add(frame);
  // 盆架
  for (let i = 0; i < 4; i += 1) {
    const a = Math.PI / 4 + (i * Math.PI) / 2;
    const arm = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.006, 0.2), m.steel);
    arm.position.set(Math.cos(a) * 0.17, Math.sin(a) * 0.17, -0.08);
    arm.lookAt(new THREE.Vector3(0, 0, -0.16));
    cone.add(arm);
  }
  const magnet = new THREE.Mesh(new THREE.CylinderGeometry(0.085, 0.085, 0.05, 40), m.ferriteMagnet);
  magnet.rotation.x = Math.PI / 2;
  magnet.position.z = -0.17;
  cone.add(magnet);
  for (const z of [-0.142, -0.198]) {
    const plate = new THREE.Mesh(new THREE.CylinderGeometry(0.088, 0.088, 0.008, 40), m.steel);
    plate.rotation.x = Math.PI / 2;
    plate.position.z = z;
    cone.add(plate);
  }
  cone.scale.set(1.55, 0.95, 1);
  cone.position.set((g.x0 + g.x1) / 2, (g.y0 + g.y1) / 2, BEZEL.backZ - 0.005);
  group.add(cone);
  return group;
}

function buildLegs(m) {
  const group = new THREE.Group();
  group.name = '木腿';
  const legH = CAB.bottom - (-1.45) - 0.04;
  for (const x of [-1.95, 1.95]) {
    for (const z of [1.02, -0.32]) {
      const leg = new THREE.Group();
      const body = new THREE.Mesh(new THREE.CylinderGeometry(0.075, 0.05, legH, 32), m.wood);
      body.position.y = -legH / 2;
      leg.add(body);
      const ferrule = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.047, 0.05, 32), m.brassCut);
      ferrule.position.y = -legH - 0.018;
      leg.add(ferrule);
      const plate = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.11, 0.012, 32), m.steelCut);
      plate.position.y = -0.006;
      leg.add(plate);
      leg.position.set(x, CAB.bottom, z);
      leg.rotation.z = x > 0 ? 0.06 : -0.06;
      leg.rotation.x = z > 0 ? 0.04 : -0.04;
      group.add(leg);
    }
  }
  return group;
}

function buildBackCover(m, cutPlanes) {
  const group = new THREE.Group();
  group.name = '后盖';
  const st = (z, a, b, cy, n = 10) => ({ z, a, b, n, cx: 0, cy });
  const stations = [
    st(-0.48, 2.14, 1.34, 0.3, 14),
    st(-0.6, 2.14, 1.34, 0.3, 14),
    st(-0.61, 2.26, 1.46, 0.3, 14),
    st(-0.67, 2.26, 1.46, 0.3, 14),
    st(-0.69, 2.12, 1.34, 0.3, 12),
    st(-0.74, 2.08, 1.31, 0.29, 10),
    st(-1.1, 1.82, 1.18, 0.16, 8),
    st(-1.5, 1.5, 1.05, 0.02, 7),
    st(-1.85, 1.18, 0.88, 0.16, 6),
    st(-2.15, 0.9, 0.72, 0.3, 5.5),
    st(-2.3, 0.82, 0.64, 0.3, 5),
    st(-2.36, 0.75, 0.57, 0.3, 4.6),
    st(-2.39, 0.6, 0.44, 0.3, 4.2),
  ];
  const mat = m.backCover.clone();
  mat.alphaMap = createVentAlpha();
  // clone() 会复制出独立的剖切平面，这里改回共享的那一个
  mat.clippingPlanes = cutPlanes;
  mat.onBeforeCompile = m.backCover.onBeforeCompile;
  mat.customProgramCacheKey = m.backCover.customProgramCacheKey;
  const geo = loftGeometry(stations, 256, { capEnd: true });
  const cover = new THREE.Mesh(geo, mat);
  cover.name = '后盖';
  group.add(cover);

  // 后盖固定螺丝
  for (const [x, y] of [
    [-2.0, 1.62],
    [2.0, 1.62],
    [-2.0, -1.02],
    [2.0, -1.02],
  ]) {
    const screw = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, 0.02, 20), m.steelCut);
    screw.rotation.x = Math.PI / 2;
    screw.position.set(x, y, -0.68);
    group.add(screw);
  }

  // 警告贴纸
  const stickerMat = new THREE.MeshStandardMaterial({
    map: createStickerTexture(),
    roughness: 0.75,
    clippingPlanes: cutPlanes,
    clipIntersection: true,
  });
  const sticker = new THREE.Mesh(new THREE.PlaneGeometry(0.62, 0.39), stickerMat);
  sticker.position.set(0, 0.3, -2.398);
  sticker.rotation.y = Math.PI;
  group.add(sticker);
  return group;
}

function buildAntenna(m) {
  const group = new THREE.Group();
  group.name = '拉杆天线';
  const base = new THREE.Group();
  const profile = [
    [0, 0],
    [0.27, 0],
    [0.27, 0.018],
    [0.25, 0.04],
    [0.21, 0.09],
    [0.15, 0.13],
    [0.09, 0.15],
    [0, 0.152],
  ].map(([x, y]) => new THREE.Vector2(x, y));
  const dome = new THREE.Mesh(new THREE.LatheGeometry(profile, 64), m.knob);
  base.add(dome);
  const ring = new THREE.Mesh(new THREE.TorusGeometry(0.255, 0.008, 8, 64), m.chrome);
  ring.rotation.x = Math.PI / 2;
  ring.position.y = 0.03;
  base.add(ring);
  const hub = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.13, 24), m.chrome);
  hub.rotation.z = Math.PI / 2;
  hub.position.y = 0.17;
  base.add(hub);
  const stand = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.05, 0.05), m.blackPlastic);
  stand.position.y = 0.145;
  base.add(stand);

  for (const side of [-1, 1]) {
    const dir = new THREE.Vector3(side * Math.sin(0.62), Math.cos(0.62), -0.22).normalize();
    const quat = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir);
    const start = new THREE.Vector3(side * 0.07, 0.17, 0);
    const sections = [
      [0.62, 0.021],
      [0.6, 0.017],
      [0.58, 0.0135],
      [0.55, 0.0105],
    ];
    let offset = 0;
    for (let i = 0; i < sections.length; i += 1) {
      const [len, r] = sections[i];
      const rod = new THREE.Mesh(new THREE.CylinderGeometry(r, r, len, 16), m.chrome);
      const center = start.clone().addScaledVector(dir, offset + len / 2);
      rod.position.copy(center);
      rod.quaternion.copy(quat);
      base.add(rod);
      const collar = new THREE.Mesh(new THREE.CylinderGeometry(r * 1.25, r * 1.25, 0.03, 16), m.chrome);
      collar.position.copy(start.clone().addScaledVector(dir, offset + len - 0.015));
      collar.quaternion.copy(quat);
      base.add(collar);
      offset += len - 0.06;
    }
    const tip = new THREE.Mesh(new THREE.SphereGeometry(0.02, 16, 12), m.chrome);
    tip.position.copy(start.clone().addScaledVector(dir, offset + 0.06));
    base.add(tip);
    const knuckle = new THREE.Mesh(new THREE.SphereGeometry(0.034, 20, 14), m.chrome);
    knuckle.position.copy(start);
    base.add(knuckle);
  }
  base.position.set(ANTENNA.x, CAB.top, ANTENNA.z);
  group.add(base);

  // 300Ω 扁平馈线：从天线座后方钻入机壳
  const leadMat = new THREE.MeshStandardMaterial({ color: 0x6b4429, roughness: 0.55 });
  group.add(
    ribbon(
      [
        new THREE.Vector3(ANTENNA.x + 0.05, CAB.top + 0.05, ANTENNA.z - 0.26),
        new THREE.Vector3(ANTENNA.x + 0.08, CAB.top + 0.02, ANTENNA.z - 0.42),
        new THREE.Vector3(ANTENNA.x + 0.12, CAB.top - 0.01, ANTENNA.z - 0.52),
      ],
      0.032,
      0.007,
      leadMat,
      20,
    ),
  );
  // 机内走线：沿顶板内侧到前方，再沿面框上沿横穿到高频头，避开显像管
  group.add(
    ribbon(
      [
        new THREE.Vector3(ANTENNA.x + 0.12, CAB.top - CAB.wall - 0.01, ANTENNA.z - 0.5),
        new THREE.Vector3(ANTENNA.x + 0.05, CAB.top - CAB.wall - 0.03, 0.1),
        new THREE.Vector3(ANTENNA.x + 0.2, CAB.top - CAB.wall - 0.04, 1.08),
        new THREE.Vector3(0.6, CAB.top - CAB.wall - 0.05, 1.12),
        new THREE.Vector3(1.3, 1.5, 1.0),
        new THREE.Vector3(1.48, 1.36, 0.7),
        new THREE.Vector3(1.48, 1.35, 0.3),
        new THREE.Vector3(1.48, 1.15, 0.33),
      ],
      0.032,
      0.007,
      leadMat,
      100,
    ),
  );
  return group;
}

