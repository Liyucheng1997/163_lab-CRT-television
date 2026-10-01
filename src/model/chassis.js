import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { NECK, PCB, SX, SY } from './dims.js';
import { mulberry32, tube } from './utils.js';
import { PANEL_LAYOUT } from './cabinet.js';

const TOP = PCB.y + PCB.thickness / 2;

export function buildChassis(m, anodeAnchor) {
  const group = new THREE.Group();
  group.name = 'chassis';
  const parts = {};
  const rand = mulberry32(1983);

  // —— 主板 ——
  const board = new THREE.Group();
  board.name = '主电路板';
  const w = PCB.maxX - PCB.minX;
  const d = PCB.maxZ - PCB.minZ;
  const pcb = new THREE.Mesh(new THREE.BoxGeometry(w, PCB.thickness, d), [
    m.pcbEdge,
    m.pcbEdge,
    m.pcb,
    m.pcbEdge,
    m.pcbEdge,
    m.pcbEdge,
  ]);
  pcb.position.set((PCB.minX + PCB.maxX) / 2, PCB.y, (PCB.minZ + PCB.maxZ) / 2);
  board.add(pcb);
  // 镀锌钢导轨
  for (const x of [PCB.minX + 0.02, PCB.maxX - 0.02]) {
    const rail = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.07, d - 0.04), m.steel);
    rail.position.set(x, PCB.y - 0.045, pcb.position.z);
    board.add(rail);
    const lip = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.01, d - 0.04), m.steel);
    lip.position.set(x + Math.sign(x) * 0.025, PCB.y - 0.075, pcb.position.z);
    board.add(lip);
  }
  group.add(board);
  parts.board = board;

  const reserved = [];
  const reserve = (x0, x1, z0, z1) => reserved.push([x0, x1, z0, z1]);

  parts.flyback = buildFlyback(m, 1.12, -0.5);
  group.add(parts.flyback);
  reserve(0.82, 1.45, -0.72, -0.28);

  parts.transformer = buildPowerTransformer(m, -1.18, -0.68);
  group.add(parts.transformer);
  reserve(-1.5, -0.86, -0.98, -0.38);

  for (const [x, z] of [
    [-0.7, -0.86],
    [-0.7, -0.6],
  ]) {
    group.add(bigCapacitor(m, x, z, 0.082, 0.3, 0x2c4f8c));
  }
  reserve(-0.82, -0.58, -0.98, -0.48);

  parts.heatsink = buildHeatsink(m, 0.3, -0.98);
  group.add(parts.heatsink);
  reserve(0.02, 0.6, -1.12, -0.86);

  const ifStrip = new THREE.Group();
  ifStrip.name = '中频放大';
  for (let i = 0; i < 5; i += 1) {
    ifStrip.add(ifCan(m, -0.32 + i * 0.16, 0.02));
  }
  group.add(ifStrip);
  parts.ifStrip = ifStrip;
  reserve(-0.42, 0.42, -0.06, 0.1);

  // 集成电路
  for (const [x, z, pins] of [
    [-0.2, -0.38, 8],
    [0.42, -0.42, 7],
    [-0.15, 0.32, 9],
  ]) {
    group.add(dipChip(m, x, z, pins));
    reserve(x - 0.17, x + 0.17, z - 0.07, z + 0.07);
  }

  // 保险丝座
  group.add(fuse(m, -1.45, -0.25));
  reserve(-1.6, -1.3, -0.3, -0.2);

  // 线束插座
  for (const [x, z] of [
    [0.0, -0.9],
    [-0.32, -1.04],
    [1.32, 0.52],
  ]) {
    const header = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.06, 0.05), m.connector);
    header.position.set(x, TOP + 0.03, z);
    group.add(header);
    reserve(x - 0.1, x + 0.1, z - 0.05, z + 0.05);
  }

  group.add(populateSmallParts(m, rand, reserved));

  parts.tuner = buildTuner(m);
  group.add(parts.tuner);

  // 电位器（小旋钮后方）
  for (const k of PANEL_LAYOUT.small) {
    const pot = new THREE.Group();
    const can = new THREE.Mesh(new THREE.CylinderGeometry(0.075, 0.075, 0.05, 32), m.tinplate);
    can.rotation.x = Math.PI / 2;
    pot.add(can);
    const back = new THREE.Mesh(new THREE.CylinderGeometry(0.072, 0.072, 0.012, 32), m.pcbEdge);
    back.rotation.x = Math.PI / 2;
    back.position.z = -0.03;
    pot.add(back);
    for (let i = -1; i <= 1; i += 1) {
      const lug = new THREE.Mesh(new THREE.BoxGeometry(0.014, 0.05, 0.004), m.tinplate);
      lug.position.set(i * 0.035, -0.09, -0.02);
      pot.add(lug);
    }
    pot.position.set(k.x, k.y, 1.165);
    group.add(pot);
  }

  // —— 线束 ——
  const wires = new THREE.Group();
  wires.name = '线束';
  const yokeColors = [0xc0392b, 0x2e6fb5, 0xe2b93b, 0x3d8b46];
  yokeColors.forEach((c, i) => {
    const o = (i - 1.5) * 0.022;
    wires.add(
      tube(
        [
          new THREE.Vector3(SX + 0.15 + o, SY - 0.05, -0.84),
          new THREE.Vector3(SX + 0.3 + o, SY - 0.35, -0.9),
          new THREE.Vector3(-0.1 + o, -0.6, -0.95),
          new THREE.Vector3(0.0 + o, TOP + 0.08, -0.9),
        ],
        0.008,
        m.wire(c),
        { segments: 40, radial: 6 },
      ),
    );
  });
  [0x1c1c1c, 0xc0392b, 0xd0d0d0, 0x8a5a2b, 0xe2b93b].forEach((c, i) => {
    const o = (i - 2) * 0.018;
    wires.add(
      tube(
        [
          new THREE.Vector3(SX + o, SY - 0.24, NECK.endZ - 0.24),
          new THREE.Vector3(SX + 0.05 + o, SY - 0.6, NECK.endZ - 0.18),
          new THREE.Vector3(-0.38 + o, -0.75, -1.25),
          new THREE.Vector3(-0.32 + o, TOP + 0.07, -1.04),
        ],
        0.007,
        m.wire(c),
        { segments: 40, radial: 6 },
      ),
    );
  });
  const g = PANEL_LAYOUT.grille;
  for (const [c, o] of [
    [0xc0392b, 0],
    [0x1c1c1c, 0.02],
  ]) {
    wires.add(
      tube(
        [
          new THREE.Vector3((g.x0 + g.x1) / 2 + o, (g.y0 + g.y1) / 2 - 0.05, 0.98),
          new THREE.Vector3(1.45 + o, -0.75, 0.8),
          new THREE.Vector3(1.32 + o, TOP + 0.06, 0.52),
        ],
        0.007,
        m.wire(c),
        { segments: 24, radial: 6 },
      ),
    );
  }
  // 高频头输出同轴线
  wires.add(
    tube(
      [
        new THREE.Vector3(1.45, 0.66, 0.6),
        new THREE.Vector3(1.4, 0.2, 0.4),
        new THREE.Vector3(0.9, -0.6, 0.25),
        new THREE.Vector3(0.5, TOP + 0.04, 0.05),
      ],
      0.014,
      m.wire(0x8a8d90),
      { segments: 40, radial: 8 },
    ),
  );
  // 电源线：从主板穿过后盖垂到地面
  const cord = m.wire(0x3b2a20);
  wires.add(
    tube(
      [
        new THREE.Vector3(-1.38, TOP + 0.03, -0.3),
        new THREE.Vector3(-1.5, TOP + 0.05, -0.95),
        new THREE.Vector3(-1.56, -0.92, -1.35),
        new THREE.Vector3(-1.66, -0.98, -1.6),
        new THREE.Vector3(-1.78, -1.32, -1.95),
        new THREE.Vector3(-1.9, -1.43, -2.45),
        new THREE.Vector3(-2.3, -1.43, -3.6),
        new THREE.Vector3(-2.9, -1.43, -5.2),
      ],
      0.02,
      cord,
      { segments: 120, radial: 8 },
    ),
  );
  group.add(wires);

  // —— 高压线（阳极帽 → 行输出变压器） ——
  // 从阳极帽绕到显像管左侧，经管锥下方走到行输出变压器
  const hv = tube(
    [
      anodeAnchor.clone(),
      anodeAnchor.clone().add(new THREE.Vector3(-0.12, 0.12, -0.04)),
      new THREE.Vector3(-1.55, 0.95, 0.05),
      new THREE.Vector3(-1.62, 0.1, -0.15),
      new THREE.Vector3(-1.1, -0.42, -0.25),
      new THREE.Vector3(0.2, -0.52, -0.3),
      new THREE.Vector3(0.82, -0.5, -0.45),
      new THREE.Vector3(0.99, TOP + 0.36, -0.5),
    ],
    0.024,
    m.hvCable,
    { segments: 160, radial: 12 },
  );
  hv.name = '高压线';
  group.add(hv);

  return { group, parts };
}

function buildFlyback(m, x, z) {
  const g = new THREE.Group();
  g.name = '行输出变压器';
  const base = new THREE.Mesh(new THREE.BoxGeometry(0.38, 0.07, 0.28), m.epoxy);
  base.position.set(x, TOP + 0.035, z);
  g.add(base);
  // U 形磁芯
  for (const dx of [-0.13, 0.15]) {
    const leg = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.3, 0.085), m.ferriteMagnet);
    leg.position.set(x + dx, TOP + 0.07 + 0.15, z);
    g.add(leg);
  }
  const bar = new THREE.Mesh(new THREE.BoxGeometry(0.37, 0.065, 0.085), m.ferriteMagnet);
  bar.position.set(x + 0.01, TOP + 0.4, z);
  g.add(bar);
  const clip = new THREE.Mesh(new THREE.BoxGeometry(0.39, 0.012, 0.03), m.steel);
  clip.position.set(x + 0.01, TOP + 0.438, z);
  g.add(clip);
  // 高压绕组（环氧灌封）
  const hvCoil = new THREE.Mesh(new THREE.CylinderGeometry(0.105, 0.11, 0.24, 40), m.epoxy);
  hvCoil.position.set(x - 0.13, TOP + 0.2, z);
  g.add(hvCoil);
  const ridge = new THREE.Mesh(new THREE.TorusGeometry(0.108, 0.008, 8, 40), m.epoxy);
  ridge.rotation.x = Math.PI / 2;
  ridge.position.set(x - 0.13, TOP + 0.27, z);
  g.add(ridge);
  // 初级绕组（黄色胶带）
  const tape = new THREE.MeshStandardMaterial({ color: 0xd8b43c, roughness: 0.45 });
  const pri = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, 0.15, 32), tape);
  pri.position.set(x + 0.15, TOP + 0.17, z);
  g.add(pri);
  // 聚焦电位器
  const pot = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.03, 16), m.connector);
  pot.rotation.z = Math.PI / 2;
  pot.position.set(x - 0.24, TOP + 0.18, z);
  g.add(pot);
  return g;
}

function buildPowerTransformer(m, x, z) {
  const g = new THREE.Group();
  g.name = '电源变压器';
  const coreW = 0.42;
  const coreH = 0.36;
  const coreD = 0.24;
  for (const dx of [-1, 1]) {
    const side = new THREE.Mesh(new THREE.BoxGeometry(0.09, coreH, coreD), m.lamination);
    side.position.set(x + dx * (coreW / 2 - 0.045), TOP + 0.03 + coreH / 2, z);
    g.add(side);
  }
  for (const dy of [0, 1]) {
    const yoke = new THREE.Mesh(new THREE.BoxGeometry(coreW, 0.07, coreD), m.lamination);
    yoke.position.set(x, TOP + 0.03 + 0.035 + dy * (coreH - 0.07), z);
    g.add(yoke);
  }
  const paper = new THREE.MeshStandardMaterial({ color: 0xc9b07c, roughness: 0.8 });
  const coil = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.22, 0.36), paper);
  coil.position.set(x, TOP + 0.03 + coreH / 2, z);
  g.add(coil);
  const wrap = new THREE.Mesh(new THREE.BoxGeometry(0.245, 0.04, 0.365), m.copperPlain);
  wrap.position.set(x, TOP + 0.03 + coreH / 2 - 0.06, z);
  g.add(wrap);
  // 固定支架
  for (const dz of [-1, 1]) {
    const bracket = new THREE.Mesh(new THREE.BoxGeometry(coreW + 0.12, 0.012, 0.05), m.steel);
    bracket.position.set(x, TOP + 0.03, z + dz * (coreD / 2 - 0.02));
    g.add(bracket);
    const strap = new THREE.Mesh(new THREE.BoxGeometry(coreW + 0.01, coreH + 0.01, 0.012), m.steel);
    strap.position.set(x, TOP + 0.03 + coreH / 2, z + dz * (coreD / 2 + 0.004));
    g.add(strap);
  }
  for (const [c, dx] of [
    [0xc0392b, -0.06],
    [0x1c1c1c, 0],
    [0xe2b93b, 0.06],
  ]) {
    g.add(
      tube(
        [
          new THREE.Vector3(x + dx, TOP + 0.3, z + 0.18),
          new THREE.Vector3(x + dx, TOP + 0.2, z + 0.3),
          new THREE.Vector3(x + dx + 0.1, TOP + 0.01, z + 0.38),
        ],
        0.007,
        m.wire(c),
        { segments: 16, radial: 6 },
      ),
    );
  }
  return g;
}

function bigCapacitor(m, x, z, r, h, color) {
  const g = new THREE.Group();
  const sleeveMat = m.capSleeve.clone();
  sleeveMat.color = new THREE.Color(color);
  const body = new THREE.Mesh(new THREE.CylinderGeometry(r, r, h, 40, 1, true), sleeveMat);
  body.position.set(x, TOP + h / 2, z);
  g.add(body);
  const top = new THREE.Mesh(new THREE.CylinderGeometry(r * 0.97, r, 0.01, 40), m.capTop);
  top.position.set(x, TOP + h + 0.004, z);
  g.add(top);
  const roll = new THREE.Mesh(new THREE.TorusGeometry(r * 0.985, 0.006, 8, 40), sleeveMat);
  roll.rotation.x = Math.PI / 2;
  roll.position.set(x, TOP + h - 0.02, z);
  g.add(roll);
  return g;
}

function buildHeatsink(m, x, z) {
  const g = new THREE.Group();
  g.name = '散热片';
  const shape = new THREE.Shape();
  const width = 0.52;
  const fins = 9;
  shape.moveTo(-width / 2, 0);
  shape.lineTo(width / 2, 0);
  shape.lineTo(width / 2, 0.02);
  for (let i = fins - 1; i >= 0; i -= 1) {
    const fx = -width / 2 + (i / (fins - 1)) * (width - 0.012);
    shape.lineTo(fx + 0.012, 0.02);
    shape.lineTo(fx + 0.012, 0.25);
    shape.lineTo(fx, 0.25);
    shape.lineTo(fx, 0.02);
  }
  shape.lineTo(-width / 2, 0.02);
  shape.closePath();
  const sink = new THREE.Mesh(new THREE.ExtrudeGeometry(shape, { depth: 0.1, bevelEnabled: false }), m.heatsink);
  sink.position.set(x, TOP, z - 0.05);
  g.add(sink);
  // TO-220 功率管装在前面
  for (let i = 0; i < 3; i += 1) {
    const body = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.09, 0.025), m.epoxy);
    body.position.set(x - 0.16 + i * 0.16, TOP + 0.09, z + 0.07);
    g.add(body);
    const tab = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.05, 0.008), m.tinplate);
    tab.position.set(body.position.x, TOP + 0.155, z + 0.06);
    g.add(tab);
    for (let p = -1; p <= 1; p += 1) {
      const leg = new THREE.Mesh(new THREE.BoxGeometry(0.008, 0.05, 0.004), m.lead);
      leg.position.set(body.position.x + p * 0.02, TOP + 0.025, z + 0.07);
      g.add(leg);
    }
  }
  return g;
}

function ifCan(m, x, z) {
  const g = new THREE.Group();
  const can = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.13, 0.1), m.tinplate);
  can.position.set(x, TOP + 0.065, z);
  g.add(can);
  const slug = new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.022, 0.012, 16), m.ferriteMagnet);
  slug.position.set(x, TOP + 0.134, z);
  g.add(slug);
  const slot = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.004, 0.006), m.steel);
  slot.position.set(x, TOP + 0.141, z);
  g.add(slot);
  return g;
}

function dipChip(m, x, z, pins) {
  const g = new THREE.Group();
  const len = 0.04 * pins + 0.02;
  const body = new THREE.Mesh(new THREE.BoxGeometry(len, 0.035, 0.085), m.epoxy);
  body.position.set(x, TOP + 0.03, z);
  g.add(body);
  const notch = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.004, 12), m.blackPlastic);
  notch.position.set(x - len / 2 + 0.025, TOP + 0.048, z);
  g.add(notch);
  for (let i = 0; i < pins; i += 1) {
    for (const s of [-1, 1]) {
      const pin = new THREE.Mesh(new THREE.BoxGeometry(0.012, 0.03, 0.02), m.lead);
      pin.position.set(x - len / 2 + 0.03 + i * 0.04, TOP + 0.016, z + s * 0.05);
      g.add(pin);
    }
  }
  return g;
}

function fuse(m, x, z) {
  const g = new THREE.Group();
  for (const dx of [-0.05, 0.05]) {
    const clip = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.05, 0.03), m.tinplate);
    clip.position.set(x + dx, TOP + 0.025, z);
    g.add(clip);
  }
  const glass = new THREE.Mesh(
    new THREE.CylinderGeometry(0.014, 0.014, 0.1, 16),
    new THREE.MeshPhysicalMaterial({ color: 0xe8f0ee, roughness: 0.05, transparent: true, opacity: 0.45 }),
  );
  glass.rotation.z = Math.PI / 2;
  glass.position.set(x, TOP + 0.045, z);
  g.add(glass);
  for (const dx of [-0.05, 0.05]) {
    const capEnd = new THREE.Mesh(new THREE.CylinderGeometry(0.016, 0.016, 0.02, 16), m.chrome);
    capEnd.rotation.z = Math.PI / 2;
    capEnd.position.set(x + dx, TOP + 0.045, z);
    g.add(capEnd);
  }
  return g;
}

function buildTuner(m) {
  const g = new THREE.Group();
  g.name = '高频调谐器';
  const ch = PANEL_LAYOUT.channel;
  const x0 = ch.x - 0.33;
  const x1 = ch.x + 0.33;
  const y0 = ch.y - 0.34;
  const y1 = ch.y + 0.3;
  const z0 = 0.4;
  const z1 = 1.12;
  const box = new THREE.Mesh(new THREE.BoxGeometry(x1 - x0, y1 - y0, z1 - z0), m.tinplate);
  box.position.set((x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2);
  g.add(box);
  // 盖板压边
  for (const dy of [y0 - 0.004, y1 + 0.004]) {
    const seam = new THREE.Mesh(new THREE.BoxGeometry(x1 - x0 + 0.01, 0.01, z1 - z0 + 0.01), m.tinplate);
    seam.position.set(box.position.x, dy, box.position.z);
    g.add(seam);
  }
  // 顶部调谐孔
  for (let i = 0; i < 4; i += 1) {
    const hole = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.01, 16), m.epoxy);
    hole.position.set(x0 + 0.12 + i * 0.14, y1 + 0.006, z0 + 0.3);
    g.add(hole);
  }
  // 转轴
  const shaft = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.12, 16), m.steel);
  shaft.rotation.x = Math.PI / 2;
  shaft.position.set(ch.x, ch.y, z1 + 0.05);
  g.add(shaft);
  // 天线输入端子
  const term = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.08, 0.05), m.connector);
  term.position.set(ch.x - 0.05, ch.y + 0.14, z0 - 0.025);
  g.add(term);
  for (const dx of [-0.03, 0.03]) {
    const screw = new THREE.Mesh(new THREE.CylinderGeometry(0.014, 0.014, 0.02, 12), m.steel);
    screw.rotation.x = Math.PI / 2;
    screw.position.set(term.position.x + dx, term.position.y, z0 - 0.055);
    g.add(screw);
  }
  return g;
}

/** 用实例化网格铺满小元件：电阻、瓷片电容、电解电容、三极管、薄膜电容、色码电感 */
function populateSmallParts(m, rand, reserved) {
  const group = new THREE.Group();
  group.name = '元件';
  const items = { resistor: [], ceramic: [], elco: [], to92: [], film: [], choke: [] };

  const blocked = (x, z, r) =>
    reserved.some(([x0, x1, z0, z1]) => x > x0 - r && x < x1 + r && z > z0 - r && z < z1 + r);
  const maxHeight = (x, z) => (z > 0.15 && x < 0.95 ? 0.11 : 0.24);

  const step = 0.095;
  for (let x = PCB.minX + 0.08; x < PCB.maxX - 0.06; x += step) {
    for (let z = PCB.minZ + 0.08; z < PCB.maxZ - 0.05; z += step) {
      if (rand() < 0.3) continue;
      const jx = x + (rand() - 0.5) * 0.02;
      const jz = z + (rand() - 0.5) * 0.02;
      if (blocked(jx, jz, 0.06)) continue;
      const hMax = maxHeight(jx, jz);
      const r = rand();
      const rot = rand() < 0.5 ? 0 : Math.PI / 2;
      if (r < 0.4) items.resistor.push({ x: jx, z: jz, rot, metal: rand() < 0.3 });
      else if (r < 0.55) items.ceramic.push({ x: jx, z: jz, rot });
      else if (r < 0.72) {
        const h = Math.min(hMax - 0.01, 0.06 + rand() * 0.12);
        items.elco.push({ x: jx, z: jz, h, rad: 0.026 + rand() * 0.022 });
      } else if (r < 0.84) items.to92.push({ x: jx, z: jz, rot: rand() * Math.PI * 2 });
      else if (r < 0.94) items.film.push({ x: jx, z: jz, rot, kind: Math.floor(rand() * 3) });
      else items.choke.push({ x: jx, z: jz, rot });
    }
  }

  const dummy = new THREE.Object3D();
  const color = new THREE.Color();

  // 电阻（狗骨形 + 引脚）
  const resGeo = new THREE.LatheGeometry(
    [
      [0, -0.045],
      [0.012, -0.045],
      [0.017, -0.04],
      [0.017, -0.026],
      [0.014, -0.018],
      [0.014, 0.018],
      [0.017, 0.026],
      [0.017, 0.04],
      [0.012, 0.045],
      [0, 0.045],
    ].map(([a, b]) => new THREE.Vector2(a, b)),
    16,
  );
  resGeo.rotateZ(Math.PI / 2);
  const leadGeo = mergeGeometries([
    new THREE.CylinderGeometry(0.0035, 0.0035, 0.04, 5).translate(-0.065, -0.02, 0),
    new THREE.CylinderGeometry(0.0035, 0.0035, 0.04, 5).translate(0.065, -0.02, 0),
    new THREE.CylinderGeometry(0.0035, 0.0035, 0.025, 5).rotateZ(Math.PI / 2).translate(-0.055, 0, 0),
    new THREE.CylinderGeometry(0.0035, 0.0035, 0.025, 5).rotateZ(Math.PI / 2).translate(0.055, 0, 0),
  ]);
  const resMesh = new THREE.InstancedMesh(resGeo, m.resistor, items.resistor.length);
  const resLeads = new THREE.InstancedMesh(leadGeo, m.lead, items.resistor.length);
  items.resistor.forEach((it, i) => {
    dummy.position.set(it.x, TOP + 0.04, it.z);
    dummy.rotation.set(0, it.rot, 0);
    dummy.updateMatrix();
    resMesh.setMatrixAt(i, dummy.matrix);
    resLeads.setMatrixAt(i, dummy.matrix);
    resMesh.setColorAt(i, color.set(it.metal ? 0x7fb2d9 : 0xe3cfa2));
  });
  group.add(resMesh, resLeads);

  // 瓷片电容
  const discGeo = new THREE.SphereGeometry(0.03, 20, 12).scale(1, 1, 0.32);
  const discMesh = new THREE.InstancedMesh(discGeo, m.ceramic, items.ceramic.length);
  const discLeads = new THREE.InstancedMesh(
    mergeGeometries([
      new THREE.CylinderGeometry(0.003, 0.003, 0.05, 5).translate(-0.012, -0.025, 0),
      new THREE.CylinderGeometry(0.003, 0.003, 0.05, 5).translate(0.012, -0.025, 0),
    ]),
    m.lead,
    items.ceramic.length,
  );
  items.ceramic.forEach((it, i) => {
    dummy.position.set(it.x, TOP + 0.055, it.z);
    dummy.rotation.set(0, it.rot, 0);
    dummy.updateMatrix();
    discMesh.setMatrixAt(i, dummy.matrix);
    discLeads.setMatrixAt(i, dummy.matrix);
    discMesh.setColorAt(i, color.setHSL(0.06 + rand() * 0.03, 0.7, 0.35 + rand() * 0.15));
  });
  group.add(discMesh, discLeads);

  // 小电解电容
  const sleeveGeo = new THREE.CylinderGeometry(1, 1, 1, 24, 1, true);
  const topGeo = new THREE.CircleGeometry(0.98, 24).rotateX(-Math.PI / 2);
  const elco = new THREE.InstancedMesh(sleeveGeo, m.capSleeve, items.elco.length);
  const elcoTop = new THREE.InstancedMesh(topGeo, m.capTop, items.elco.length);
  const palette = [0x2a4f9a, 0x161616, 0x3c2a5a, 0x6b2420, 0x1f5a6b];
  items.elco.forEach((it, i) => {
    dummy.position.set(it.x, TOP + it.h / 2, it.z);
    dummy.rotation.set(0, rand() * Math.PI * 2, 0);
    dummy.scale.set(it.rad, it.h, it.rad);
    dummy.updateMatrix();
    elco.setMatrixAt(i, dummy.matrix);
    elco.setColorAt(i, color.set(palette[Math.floor(rand() * palette.length)]).multiplyScalar(2.2));
    dummy.position.y = TOP + it.h + 0.0005;
    dummy.scale.set(it.rad, 1, it.rad);
    dummy.updateMatrix();
    elcoTop.setMatrixAt(i, dummy.matrix);
  });
  dummy.scale.set(1, 1, 1);
  group.add(elco, elcoTop);

  // TO-92 三极管
  const dShape = new THREE.Shape();
  dShape.absarc(0, 0, 0.022, 0, Math.PI, false);
  dShape.lineTo(0.022, 0);
  const toGeo = new THREE.ExtrudeGeometry(dShape, { depth: 0.05, bevelEnabled: false, curveSegments: 12 })
    .rotateX(-Math.PI / 2)
    .translate(0, 0.03, 0);
  const toLegs = mergeGeometries(
    [-0.012, 0, 0.012].map((dx) => new THREE.CylinderGeometry(0.003, 0.003, 0.03, 5).translate(dx, 0.015, -0.008)),
  );
  const to92 = new THREE.InstancedMesh(toGeo, m.epoxy, items.to92.length);
  const to92Legs = new THREE.InstancedMesh(toLegs, m.lead, items.to92.length);
  items.to92.forEach((it, i) => {
    dummy.position.set(it.x, TOP, it.z);
    dummy.rotation.set(0, it.rot, 0);
    dummy.updateMatrix();
    to92.setMatrixAt(i, dummy.matrix);
    to92Legs.setMatrixAt(i, dummy.matrix);
  });
  group.add(to92, to92Legs);

  // 薄膜电容
  const filmGeo = new THREE.BoxGeometry(0.07, 0.055, 0.028);
  const film = new THREE.InstancedMesh(filmGeo, new THREE.MeshPhysicalMaterial({ roughness: 0.3, clearcoat: 0.8 }), items.film.length);
  const filmColors = [0xd6b23a, 0x2f5ea6, 0x9c3b2a];
  items.film.forEach((it, i) => {
    dummy.position.set(it.x, TOP + 0.03, it.z);
    dummy.rotation.set(0, it.rot, 0);
    dummy.updateMatrix();
    film.setMatrixAt(i, dummy.matrix);
    film.setColorAt(i, color.set(filmColors[it.kind]));
  });
  group.add(film);

  // 色码电感
  const chokeGeo = new THREE.CylinderGeometry(0.02, 0.02, 0.07, 14).rotateZ(Math.PI / 2);
  const choke = new THREE.InstancedMesh(chokeGeo, m.choke, items.choke.length);
  items.choke.forEach((it, i) => {
    dummy.position.set(it.x, TOP + 0.03, it.z);
    dummy.rotation.set(0, it.rot, 0);
    dummy.updateMatrix();
    choke.setMatrixAt(i, dummy.matrix);
  });
  group.add(choke);

  for (const mesh of group.children) {
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    mesh.castShadow = true;
    mesh.receiveShadow = true;
  }
  return group;
}
