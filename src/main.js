import './styles.css';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';
import { createElement, icons } from 'lucide';
import { CAB, GUN, PCB, RASTER, SX, SY, YOKE, faceZ } from './model/dims.js';
import { createMaterials } from './model/materials.js';
import { buildCabinet, PANEL_LAYOUT } from './model/cabinet.js';
import { buildCRT } from './model/crt.js';
import { buildChassis } from './model/chassis.js';
import { buildStage } from './model/stage.js';
import { smoothstep } from './model/utils.js';
import { createTestCard } from './testcard.js';

const canvas = document.querySelector('#scene');
const renderer = new THREE.WebGLRenderer({
  canvas,
  antialias: true,
  alpha: false,
  preserveDrawingBuffer: true,
});
const pixelRatio = Math.min(window.devicePixelRatio, 2);
renderer.setPixelRatio(pixelRatio);
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.05;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.localClippingEnabled = true;

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(40, window.innerWidth / window.innerHeight, 0.05, 120);

const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.maxDistance = 18;
controls.minDistance = 2.2;
controls.maxPolarAngle = Math.PI * 0.49;

const composerTarget = new THREE.WebGLRenderTarget(
  window.innerWidth * pixelRatio,
  window.innerHeight * pixelRatio,
  { type: THREE.HalfFloatType, samples: 4 },
);
const composer = new EffectComposer(renderer, composerTarget);
composer.setPixelRatio(pixelRatio);
composer.setSize(window.innerWidth, window.innerHeight);
composer.addPass(new RenderPass(scene, camera));
const bloom = new UnrealBloomPass(new THREE.Vector2(window.innerWidth, window.innerHeight), 0.32, 0.45, 0.92);
composer.addPass(bloom);
composer.addPass(new OutputPass());

const raycaster = new THREE.Raycaster();
const pointer = new THREE.Vector2(-10, -10);
const pointerClient = { x: 0, y: 0, moved: false };
const labelLayer = document.querySelector('#labels');
const labels = [];

const state = {
  paused: false,
  mode: 'signal',
  shellOpen: true,
  beamVisible: true,
  coilVisible: true,
  signalVisible: true,
  scanSpeed: 1.15,
  brightness: 0.95,
  noise: 0.12,
  scan: 0,
  open: 1,
};

// 剖切：两张平面取交集，切掉 x > CUT_X 且 y > CUT_Y 的右上象限
const CUT_X = SX;
const CUT_Y = SY;
const CUT_FAR = 6;
const cutPlanes = [
  new THREE.Plane(new THREE.Vector3(-1, 0, 0), CUT_FAR),
  new THREE.Plane(new THREE.Vector3(0, -1, 0), CUT_FAR),
];

const testCard = createTestCard();
const sampleVideoSignal = (u, v) => clamp(testCard.sample(u, v), 0.04, 1);

const materials = createMaterials(cutPlanes);
const screenTexture = createScreenTexture();
materials.screen.emissiveMap = screenTexture.texture;
materials.screen.needsUpdate = true;
const scopes = createScopes();

const stage = buildStage(scene, renderer);

const groups = {
  television: new THREE.Group(),
  signals: new THREE.Group(),
  beam: new THREE.Group(),
};
scene.add(groups.television, groups.signals);

const cabinet = buildCabinet(materials, cutPlanes);
const crt = buildCRT(materials);
const chassis = buildChassis(materials, crt.parts.anodeAnchor);
groups.television.add(cabinet.group, crt.group, chassis.group);
crt.group.add(groups.beam);

configureShadows(groups.television);
const pickables = registerParts();

buildSignalFlow();
buildLabels();
buildUI();

const clock = new THREE.Clock();
const beam = createBeamObjects();
const meters = {
  horizontal: document.querySelector('#horizontalMeter'),
  vertical: document.querySelector('#verticalMeter'),
  video: document.querySelector('#videoMeter'),
};
const tooltip = createTooltip();
let frame = 0;

function configureShadows(root) {
  root.traverse((obj) => {
    if (!obj.isMesh) return;
    const mats = Array.isArray(obj.material) ? obj.material : [obj.material];
    const transparent = mats.some((mat) => mat.transparent || mat.alphaMap);
    obj.castShadow = !transparent;
    obj.receiveShadow = true;
  });
}

function registerParts() {
  const info = [
    [cabinet.parts.sleeve, '胡桃木外壳', '木质机箱贴胡桃木皮，外罩清漆；剖开后可见内部结构'],
    [cabinet.parts.bezel, '前面框', '塑料面框，开口斜面与显像管球面玻屏贴合'],
    [cabinet.parts.controls, '控制面板', '拉丝铝面板：频道选择、音量、亮度、对比度、电源'],
    [cabinet.parts.speaker, '扬声器', '纸盆椭圆扬声器，伴音中频解调后推动'],
    [cabinet.parts.back, '后盖', '带散热槽的塑料后盖，贴有高压警告'],
    [cabinet.parts.antenna, '拉杆天线', '接收 VHF 电视信号，经 300Ω 扁馈线送入高频头'],
    [crt.parts.screen, '荧光屏', '内壁涂荧光粉，电子撞击处发光并有短暂余辉'],
    [crt.parts.tube, '显像管', '真空玻壳，锥体外涂石墨导电层，阳极帽接约 12 kV 高压'],
    [crt.parts.gun, '电子枪', '灯丝加热阴极发射电子，栅极控制束流，聚焦极把电子束会聚成细点'],
    [crt.parts.yoke, '偏转线圈', '行线圈（鞍形）与场线圈（环形）产生磁场，使电子束水平、垂直偏转'],
    [chassis.parts.tuner, '高频调谐器', '选出所需频道并变频为中频'],
    [chassis.parts.ifStrip, '中频放大', '中周变压器组成的中频放大与视频检波'],
    [chassis.parts.flyback, '行输出变压器', '产生行扫描锯齿电流，并升压供给显像管阳极'],
    [chassis.parts.transformer, '电源变压器', '把 220V 市电降压后整流滤波'],
    [chassis.parts.heatsink, '散热片', '功率管（场输出、稳压）散热'],
    [chassis.parts.board, '主电路板', '酚醛纸基印制板，承载视频、同步分离、扫描电路'],
  ];
  const list = [];
  for (const [object, title, body] of info) {
    if (!object) continue;
    object.userData.partInfo = { title, body };
    list.push(object);
  }
  return list;
}

function buildSignalFlow() {
  const tunerPos = new THREE.Vector3(PANEL_LAYOUT.channel.x, PANEL_LAYOUT.channel.y, 0.6);
  const points = [
    new THREE.Vector3(-0.95, CAB.top + 0.35, -0.18),
    tunerPos,
    new THREE.Vector3(0.05, PCB.y + 0.25, 0.02),
    new THREE.Vector3(SX, SY, GUN.cathodeZ),
    new THREE.Vector3(SX, SY, YOKE.centerZ),
    new THREE.Vector3(SX, SY, faceZ(SX, SY) - 0.05),
  ];

  const material = new THREE.LineBasicMaterial({
    color: 0x73f6b4,
    transparent: true,
    opacity: 0.55,
    depthTest: false,
  });
  const curvePoints = [];
  for (let i = 0; i < points.length - 1; i += 1) {
    const mid = points[i].clone().lerp(points[i + 1], 0.5);
    if (i < 2) mid.y += 0.25;
    const curve = new THREE.QuadraticBezierCurve3(points[i], mid, points[i + 1]);
    const pts = curve.getPoints(40);
    curvePoints.push(pts);
    const line = new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), material);
    line.renderOrder = 10;
    groups.signals.add(line);
  }
  groups.signals.userData.paths = curvePoints;

  const pulseGeometry = new THREE.SphereGeometry(0.045, 16, 16);
  for (let i = 0; i < 8; i += 1) {
    const pulse = new THREE.Mesh(
      pulseGeometry,
      new THREE.MeshBasicMaterial({
        color: new THREE.Color(0x66d8f0).multiplyScalar(2.5),
        transparent: true,
        opacity: 0.9,
        depthTest: false,
      }),
    );
    pulse.renderOrder = 11;
    pulse.userData.offset = i / 8;
    pulse.userData.pulse = true;
    groups.signals.add(pulse);
  }

  const stageColors = [0x66d8f0, 0xf2b15e, 0x73f6b4, 0xff705d, 0xeafff5];
  const stagePositions = [points[0], points[1], points[2], points[3], points[4]];
  for (let i = 0; i < stagePositions.length; i += 1) {
    const marker = new THREE.Mesh(
      new THREE.SphereGeometry(0.06, 18, 18),
      new THREE.MeshBasicMaterial({
        color: new THREE.Color(stageColors[i]).multiplyScalar(2),
        transparent: true,
        opacity: 0.9,
        depthTest: false,
      }),
    );
    marker.renderOrder = 12;
    marker.position.copy(stagePositions[i]);
    marker.userData.stageMarker = true;
    marker.userData.stageIndex = i;
    groups.signals.add(marker);
  }
}

function buildLabels() {
  addLabel('天线接收', '把无线电波转成微弱电信号', new THREE.Vector3(-1.75, CAB.top + 0.7, -0.25));
  addLabel('调谐与放大', '高频头选台，中放检波得到视频', new THREE.Vector3(2.15, 1.3, 0.55));
  addLabel('电子枪', '阴极受热后发射电子束', new THREE.Vector3(SX + 0.75, SY + 0.2, -2.25));
  addLabel('偏转线圈', '磁场让电子束水平、垂直偏转', new THREE.Vector3(SX - 0.35, SY + 1.3, YOKE.centerZ - 0.2));
  addLabel('荧光屏', '电子撞击荧光粉形成亮点和余辉', new THREE.Vector3(SX - 1.25, SY + 1.25, 1.3));
}

function addLabel(title, body, position) {
  const el = document.createElement('div');
  el.className = 'label';
  el.innerHTML = `<strong>${title}</strong>${body}`;
  labelLayer.appendChild(el);
  labels.push({ el, position });
}

function createScreenTexture() {
  const textureCanvas = document.createElement('canvas');
  textureCanvas.width = testCard.width;
  textureCanvas.height = testCard.height;
  const ctx = textureCanvas.getContext('2d');
  // 参考画面：测试卡按 P4 白色荧光粉着色
  const reference = document.createElement('canvas');
  reference.width = textureCanvas.width;
  reference.height = textureCanvas.height;
  const referenceCtx = reference.getContext('2d');
  referenceCtx.drawImage(testCard.canvas, 0, 0);
  referenceCtx.globalCompositeOperation = 'multiply';
  referenceCtx.fillStyle = 'rgb(214, 228, 255)';
  referenceCtx.fillRect(0, 0, reference.width, reference.height);
  ctx.fillStyle = '#000';
  ctx.fillRect(0, 0, textureCanvas.width, textureCanvas.height);
  const texture = new THREE.CanvasTexture(textureCanvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 8;
  return { canvas: textureCanvas, ctx, texture, reference };
}

function createScopes() {
  return {
    rf: getScope('rfScope'),
    video: getScope('videoScope'),
    sync: getScope('syncScope'),
    line: getScope('lineScope'),
    screen: getScope('screenScope'),
  };
}

function getScope(id) {
  const scope = document.querySelector(`#${id}`);
  return scope ? { canvas: scope, ctx: scope.getContext('2d') } : null;
}

function createBeamObjects() {
  const coreMat = new THREE.MeshBasicMaterial({
    color: new THREE.Color(1.0, 0.42, 0.33).multiplyScalar(5),
    transparent: true,
    opacity: 0.95,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  });
  const haloMat = new THREE.MeshBasicMaterial({
    color: new THREE.Color(1.0, 0.36, 0.28).multiplyScalar(1.2),
    transparent: true,
    opacity: 0.22,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  });
  const core = new THREE.Mesh(new THREE.BufferGeometry(), coreMat);
  const halo = new THREE.Mesh(new THREE.BufferGeometry(), haloMat);
  core.renderOrder = 5;
  halo.renderOrder = 5;
  groups.beam.add(core, halo);

  const spot = new THREE.Mesh(
    new THREE.SphereGeometry(0.03, 16, 16),
    new THREE.MeshBasicMaterial({
      color: new THREE.Color(0.85, 0.92, 1.0).multiplyScalar(6),
      transparent: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    }),
  );
  groups.beam.add(spot);

  const light = new THREE.PointLight(0xbcd2ff, 1.5, 2.6, 2);
  groups.beam.add(light);
  return { core, halo, coreMat, haloMat, spot, light };
}

function createTooltip() {
  const el = document.createElement('div');
  el.className = 'part-tip';
  el.style.display = 'none';
  document.querySelector('#app').appendChild(el);
  return el;
}

function buildUI() {
  setIcon('#playToggle', icons.Pause);
  setIcon('#resetView', icons.RotateCcw);

  document.querySelector('#playToggle').addEventListener('click', () => {
    state.paused = !state.paused;
    setIcon('#playToggle', state.paused ? icons.Play : icons.Pause);
  });

  document.querySelector('#resetView').addEventListener('click', () => setMode(state.mode, true));

  for (const button of document.querySelectorAll('.mode-button')) {
    button.addEventListener('click', () => setMode(button.dataset.mode));
  }

  bindCheckbox('#shellOpen', 'shellOpen');
  bindCheckbox('#beamVisible', 'beamVisible');
  bindCheckbox('#coilVisible', 'coilVisible');
  bindCheckbox('#signalVisible', 'signalVisible');
  bindRange('#scanSpeed', 'scanSpeed');
  bindRange('#brightness', 'brightness');
  bindRange('#noise', 'noise');

  window.addEventListener('resize', onResize);
  renderer.domElement.addEventListener('pointermove', onPointerMove);
  renderer.domElement.addEventListener('pointerleave', () => {
    pointer.set(-10, -10);
    pointerClient.moved = true;
  });
}

function setIcon(selector, icon) {
  const target = document.querySelector(selector);
  target.replaceChildren(createElement(icon, { width: 20, height: 20, 'stroke-width': 2 }));
}

function bindCheckbox(selector, key) {
  document.querySelector(selector).addEventListener('change', (event) => {
    state[key] = event.target.checked;
    applyVisibility();
  });
}

function bindRange(selector, key) {
  document.querySelector(selector).addEventListener('input', (event) => {
    state[key] = Number(event.target.value);
  });
}

const cameraTargets = {
  overview: { position: [5.9, 2.9, 7.6], target: [0.55, 0.25, -0.3] },
  inside: { position: [4.3, 4.7, -1.75], target: [-0.3, 0.05, -0.45] },
  signal: { position: [5.9, 5.0, 5.2], target: [0.45, 0.4, -0.45] },
  screen: { position: [SX + 0.85, SY + 0.12, 6.0], target: [SX + 0.85, SY, 0.9] },
};

function setMode(mode, force = false) {
  state.mode = mode;
  for (const button of document.querySelectorAll('.mode-button')) {
    button.classList.toggle('is-active', button.dataset.mode === mode);
  }

  if (mode === 'inside' || mode === 'signal') {
    state.shellOpen = true;
  } else if (mode === 'screen' || mode === 'overview') {
    state.shellOpen = false;
  }
  document.querySelector('#shellOpen').checked = state.shellOpen;
  state.signalVisible = mode === 'signal';
  document.querySelector('#signalVisible').checked = state.signalVisible;
  if (force) state.open = state.shellOpen ? 1 : 0;

  const next = cameraTargets[mode];
  if (force) {
    camera.position.fromArray(next.position);
    controls.target.fromArray(next.target);
    camera.userData.destination = null;
    controls.update();
  } else {
    camera.userData.destination = {
      position: new THREE.Vector3().fromArray(next.position),
      target: new THREE.Vector3().fromArray(next.target),
    };
  }
  applyVisibility();
}

function applyVisibility() {
  groups.beam.visible = state.beamVisible;
  crt.parts.yoke.visible = state.coilVisible;
  groups.signals.visible = state.signalVisible;
  labelLayer.style.display = state.signalVisible ? 'block' : 'none';
}

function onResize() {
  const width = window.innerWidth;
  const height = window.innerHeight;
  camera.aspect = width / height;
  camera.updateProjectionMatrix();
  renderer.setSize(width, height);
  composer.setSize(width, height);
  bloom.setSize(width, height);
}

function onPointerMove(event) {
  pointer.x = (event.clientX / window.innerWidth) * 2 - 1;
  pointer.y = -(event.clientY / window.innerHeight) * 2 + 1;
  pointerClient.x = event.clientX;
  pointerClient.y = event.clientY;
  pointerClient.moved = true;
}

function updateOpen(delta) {
  const target = state.shellOpen ? 1 : 0;
  const speed = 1.6;
  if (state.open < target) state.open = Math.min(target, state.open + delta * speed);
  else if (state.open > target) state.open = Math.max(target, state.open - delta * speed);
  const k = smoothstep(0, 1, state.open);
  // 剖切面从远处扫入，看起来像外壳被切开
  cutPlanes[0].constant = CUT_FAR + (CUT_X - CUT_FAR) * k;
  cutPlanes[1].constant = CUT_FAR + (CUT_Y - CUT_FAR) * k;
  stage.interior.intensity = k * 1.2;
  // 外壳闭合时电子束看不到，顺便省去绘制
  groups.beam.visible = state.beamVisible && k > 0.02;
}

function updateScreen(delta) {
  const { canvas: textureCanvas, ctx, texture, reference } = screenTexture;
  const width = textureCanvas.width;
  const height = textureCanvas.height;

  // 荧光粉余辉衰减 + 残留画面
  ctx.globalCompositeOperation = 'source-over';
  ctx.globalAlpha = 1;
  ctx.fillStyle = 'rgba(3, 4, 6, 0.05)';
  ctx.fillRect(0, 0, width, height);
  ctx.globalAlpha = 0.11 * state.brightness;
  ctx.drawImage(reference, 0, 0);
  ctx.globalAlpha = 1;

  if (!state.paused) {
    state.scan = (state.scan + delta * state.scanSpeed * 0.34) % 1;
  }

  const lineCount = 156;
  const phase = state.scan * lineCount;
  const currentLine = Math.floor(phase);
  const lineProgress = phase - currentLine;
  const x = lineProgress * width;
  const y = ((currentLine % lineCount) / (lineCount - 1)) * height;

  // 扫描线间隙
  ctx.fillStyle = 'rgba(0, 0, 0, 0.07)';
  for (let scanY = 0; scanY < height; scanY += 3) {
    ctx.fillRect(0, scanY, width, 1);
  }

  ctx.globalCompositeOperation = 'lighter';
  for (let px = 0; px <= x; px += 2.5) {
    const value = sampleVideoSignal(px / width, y / height);
    const a = (0.12 + value * 0.7) * state.brightness;
    ctx.fillStyle = `rgba(${Math.round(150 + value * 90)}, ${Math.round(160 + value * 90)}, 255, ${a})`;
    ctx.fillRect(px, y - 1.4, 3.2, 2.8);
  }

  const rawSignal = sampleVideoSignal(x / width, y / height);
  const signal = clamp(rawSignal + (Math.random() - 0.5) * state.noise * 0.65, 0, 1);
  const jitter = (Math.random() - 0.5) * width * state.noise * 0.4;
  const gradient = ctx.createRadialGradient(x + jitter, y, 2, x + jitter, y, 60);
  gradient.addColorStop(0, `rgba(245, 250, 255, ${0.4 + 0.6 * signal * state.brightness})`);
  gradient.addColorStop(0.25, `rgba(170, 195, 255, ${0.15 + 0.4 * state.brightness * signal})`);
  gradient.addColorStop(1, 'rgba(150, 180, 255, 0)');
  ctx.fillStyle = gradient;
  ctx.beginPath();
  ctx.arc(x + jitter, y, 62, 0, Math.PI * 2);
  ctx.fill();

  for (let i = 0; i < Math.round(60 * state.noise); i += 1) {
    ctx.fillStyle = `rgba(230, 235, 255, ${Math.random() * 0.3})`;
    ctx.fillRect(Math.random() * width, Math.random() * height, 1 + Math.random() * 4, 1);
  }
  ctx.globalCompositeOperation = 'source-over';

  texture.needsUpdate = true;
  materials.screen.emissiveIntensity = 0.62 + state.brightness * 0.38;
  stage.screenLight.intensity = 1.6 + state.brightness * 2.2;

  const u = x / width;
  const v = y / height;
  updateBeam(u, v, signal);
  updateScopes(u, v, signal, currentLine, lineCount);
  updateConversionReadout(u, v, signal);
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

const beamPoints = [];
function updateBeam(u, v, signal) {
  const tx = SX + (u - 0.5) * 2 * RASTER.halfW;
  const ty = SY - (v - 0.5) * 2 * RASTER.halfH;
  const target = new THREE.Vector3(tx, ty, faceZ(tx, ty) - 0.05);

  // 沿轴线直行 → 在偏转线圈内弯折 → 直线射向荧光屏
  const start = new THREE.Vector3(SX, SY, GUN.exitZ);
  const entry = new THREE.Vector3(SX, SY, YOKE.backZ + 0.08);
  const center = new THREE.Vector3(SX, SY, YOKE.centerZ);
  const dir = target.clone().sub(center);
  const exit = center.clone().addScaledVector(dir, (YOKE.frontZ + 0.05 - YOKE.centerZ) / dir.z);
  const bend = new THREE.QuadraticBezierCurve3(entry, center, exit);
  beamPoints.length = 0;
  beamPoints.push(start);
  for (let i = 0; i <= 10; i += 1) beamPoints.push(bend.getPoint(i / 10));
  for (let i = 1; i <= 8; i += 1) beamPoints.push(exit.clone().lerp(target, i / 8));
  const path = new THREE.CatmullRomCurve3(beamPoints);

  beam.core.geometry.dispose();
  beam.halo.geometry.dispose();
  beam.core.geometry = new THREE.TubeGeometry(path, 48, 0.006 + signal * 0.004, 6);
  beam.halo.geometry = new THREE.TubeGeometry(path, 48, 0.022 + signal * 0.012, 8);
  beam.coreMat.opacity = 0.35 + signal * 0.65;
  beam.haloMat.opacity = 0.08 + signal * 0.2;
  beam.spot.position.copy(target);
  beam.spot.scale.setScalar(0.6 + signal * 1.3);
  beam.light.position.copy(target).add(new THREE.Vector3(0, 0, -0.15));
  beam.light.intensity = 0.4 + signal * 2.2;

  meters.horizontal.style.width = `${u * 100}%`;
  meters.vertical.style.width = `${v * 100}%`;
  meters.video.style.width = `${signal * 100}%`;
}

function updateScopes(horizontal, vertical, signal, currentLine, lineCount) {
  drawRfScope(scopes.rf, horizontal, signal);
  drawVideoScope(scopes.video, vertical, horizontal);
  drawSyncScope(scopes.sync, horizontal, currentLine / lineCount);
  drawLineScope(scopes.line, vertical, horizontal);
  drawScreenPreview(scopes.screen, horizontal, vertical);
}

function drawScopeBase(scope) {
  if (!scope) return null;
  const { canvas: scopeCanvas, ctx: scopeCtx } = scope;
  const w = scopeCanvas.width;
  const h = scopeCanvas.height;
  scopeCtx.clearRect(0, 0, w, h);
  scopeCtx.fillStyle = 'rgba(2, 13, 9, 0.88)';
  scopeCtx.fillRect(0, 0, w, h);
  scopeCtx.strokeStyle = 'rgba(219, 231, 226, 0.1)';
  scopeCtx.lineWidth = 1;
  for (let x = 0; x < w; x += 38) {
    scopeCtx.beginPath();
    scopeCtx.moveTo(x, 0);
    scopeCtx.lineTo(x, h);
    scopeCtx.stroke();
  }
  scopeCtx.beginPath();
  scopeCtx.moveTo(0, h / 2);
  scopeCtx.lineTo(w, h / 2);
  scopeCtx.stroke();
  return { scopeCtx, w, h };
}

function drawRfScope(scope, horizontal, signal) {
  const base = drawScopeBase(scope);
  if (!base) return;
  const { scopeCtx, w, h } = base;
  scopeCtx.strokeStyle = '#66d8f0';
  scopeCtx.lineWidth = 1.7;
  scopeCtx.beginPath();
  for (let x = 0; x < w; x += 1) {
    const t = x / w;
    const envelope = 0.28 + sampleVideoSignal((horizontal + t * 0.24) % 1, 0.42) * 0.33;
    const y = h / 2 + Math.sin(t * Math.PI * 42 + horizontal * 22) * envelope * h * (0.62 + signal * 0.2);
    if (x === 0) scopeCtx.moveTo(x, y);
    else scopeCtx.lineTo(x, y);
  }
  scopeCtx.stroke();
  drawScopeCursor(scopeCtx, w, h, horizontal);
}

function drawVideoScope(scope, vertical, horizontal) {
  const base = drawScopeBase(scope);
  if (!base) return;
  const { scopeCtx, w, h } = base;
  scopeCtx.strokeStyle = '#73f6b4';
  scopeCtx.lineWidth = 2;
  scopeCtx.beginPath();
  for (let x = 0; x < w; x += 1) {
    const u = x / (w - 1);
    const value = sampleVideoSignal(u, vertical);
    const y = h - 5 - value * (h - 10);
    if (x === 0) scopeCtx.moveTo(x, y);
    else scopeCtx.lineTo(x, y);
  }
  scopeCtx.stroke();
  drawScopeCursor(scopeCtx, w, h, horizontal);
}

function drawSyncScope(scope, horizontal, vertical) {
  const base = drawScopeBase(scope);
  if (!base) return;
  const { scopeCtx, w, h } = base;
  scopeCtx.fillStyle = '#f2b15e';
  const hPulse = horizontal < 0.08 ? 0.9 : 0.24;
  const vPulse = vertical < 0.035 ? 0.98 : hPulse;
  scopeCtx.fillRect(0, h - h * vPulse, w * 0.08, h * vPulse);
  scopeCtx.fillStyle = 'rgba(242, 177, 94, 0.32)';
  for (let x = 0; x < w; x += 44) {
    scopeCtx.fillRect(x, h - h * 0.42, 8, h * 0.42);
  }
  drawScopeCursor(scopeCtx, w, h, horizontal);
}

function drawLineScope(scope, vertical, horizontal) {
  const base = drawScopeBase(scope);
  if (!base) return;
  const { scopeCtx, w, h } = base;
  scopeCtx.fillStyle = 'rgba(115, 246, 180, 0.2)';
  for (let x = 0; x < w; x += 1) {
    const u = x / (w - 1);
    const value = sampleVideoSignal(u, vertical);
    const barHeight = value * (h - 8);
    scopeCtx.fillRect(x, h - 4 - barHeight, 1, barHeight);
  }
  scopeCtx.strokeStyle = '#eafff5';
  scopeCtx.lineWidth = 1.5;
  scopeCtx.beginPath();
  for (let x = 0; x < w; x += 1) {
    const u = x / (w - 1);
    const value = sampleVideoSignal(u, vertical);
    const y = h - 5 - value * (h - 10);
    if (x === 0) scopeCtx.moveTo(x, y);
    else scopeCtx.lineTo(x, y);
  }
  scopeCtx.stroke();
  drawScopeCursor(scopeCtx, w, h, horizontal);
}

function drawScreenPreview(scope, horizontal, vertical) {
  if (!scope) return;
  const { canvas: scopeCanvas, ctx: scopeCtx } = scope;
  const w = scopeCanvas.width;
  const h = scopeCanvas.height;
  scopeCtx.fillStyle = 'rgba(2, 13, 9, 0.98)';
  scopeCtx.fillRect(0, 0, w, h);

  const imageH = h - 8;
  const imageW = Math.round(imageH * (4 / 3));
  const offsetX = Math.round((w - imageW) / 2);
  const offsetY = 4;
  scopeCtx.globalAlpha = 0.9;
  scopeCtx.drawImage(screenTexture.reference, offsetX, offsetY, imageW, imageH);
  scopeCtx.globalAlpha = 1;

  const beamX = offsetX + horizontal * imageW;
  const beamY = offsetY + vertical * imageH;
  scopeCtx.strokeStyle = 'rgba(255, 112, 93, 0.75)';
  scopeCtx.lineWidth = 1;
  scopeCtx.beginPath();
  scopeCtx.moveTo(offsetX, beamY);
  scopeCtx.lineTo(offsetX + imageW, beamY);
  scopeCtx.moveTo(beamX, offsetY);
  scopeCtx.lineTo(beamX, offsetY + imageH);
  scopeCtx.stroke();

  const signal = sampleVideoSignal(horizontal, vertical);
  scopeCtx.fillStyle = `rgba(255, 140, 120, ${0.65 + signal * 0.35})`;
  scopeCtx.beginPath();
  scopeCtx.arc(beamX, beamY, 3 + signal * 2.5, 0, Math.PI * 2);
  scopeCtx.fill();
  scopeCtx.strokeStyle = 'rgba(115, 246, 180, 0.85)';
  scopeCtx.strokeRect(offsetX + 0.5, offsetY + 0.5, imageW - 1, imageH - 1);
}

function drawScopeCursor(scopeCtx, w, h, progress) {
  const x = progress * w;
  scopeCtx.strokeStyle = 'rgba(255, 255, 255, 0.85)';
  scopeCtx.lineWidth = 1;
  scopeCtx.beginPath();
  scopeCtx.moveTo(x, 0);
  scopeCtx.lineTo(x, h);
  scopeCtx.stroke();
}

const stepNames = ['receive', 'demod', 'video', 'sync', 'paint'];
const stepElements = [...document.querySelectorAll('.step')];
const explainText = document.querySelector('#explainText');
function updateConversionReadout(horizontal, vertical, signal) {
  const index = Math.min(stepNames.length - 1, Math.floor((state.scan * stepNames.length * 1.7) % stepNames.length));
  for (const step of stepElements) {
    step.classList.toggle('is-active', step.dataset.step === stepNames[index]);
  }

  const syncText = horizontal < 0.08 || vertical < 0.035 ? '同步脉冲正在校准扫描起点' : '亮度信号正在调制电子束强弱';
  explainText.textContent =
    `当前位置 x=${Math.round(horizontal * 100)}%, y=${Math.round(vertical * 100)}%；视频亮度=${Math.round(signal * 100)}%。${syncText}，屏幕上对应亮点随之变亮或变暗。`;
}

function updateSignals(elapsed) {
  const paths = groups.signals.userData.paths;
  const total = paths.length;
  for (const child of groups.signals.children) {
    if (child.userData.pulse) {
      const t = (elapsed * 0.12 + child.userData.offset) % 1;
      const scaled = t * total;
      const seg = Math.min(total - 1, Math.floor(scaled));
      const pts = paths[seg];
      const local = (scaled - seg) * (pts.length - 1);
      const i = Math.min(pts.length - 2, Math.floor(local));
      child.position.copy(pts[i]).lerp(pts[i + 1], local - i);
      child.scale.setScalar(0.75 + Math.sin((t + child.userData.offset) * Math.PI * 2) * 0.2);
    } else if (child.userData.stageMarker) {
      const activeStage = Math.floor((state.scan * 5 * 1.7) % 5);
      const isActive = child.userData.stageIndex === activeStage;
      child.scale.setScalar(isActive ? 1.7 + Math.sin(elapsed * 8) * 0.18 : 1);
      child.material.opacity = isActive ? 1 : 0.45;
    }
  }
}

function updateLabels() {
  const width = window.innerWidth;
  const height = window.innerHeight;
  for (const label of labels) {
    const pos = label.position.clone().project(camera);
    const visible = pos.z > -1 && pos.z < 1;
    label.el.style.display = visible ? 'block' : 'none';
    if (!visible) continue;
    label.el.style.left = `${(pos.x * 0.5 + 0.5) * width}px`;
    label.el.style.top = `${(-pos.y * 0.5 + 0.5) * height}px`;
  }
}

function updateCamera() {
  if (!camera.userData.destination) return;
  const { position, target } = camera.userData.destination;
  camera.position.lerp(position, 0.065);
  controls.target.lerp(target, 0.065);
  if (camera.position.distanceTo(position) < 0.02 && controls.target.distanceTo(target) < 0.02) {
    camera.userData.destination = null;
  }
}

function updateHover() {
  if (!pointerClient.moved || frame % 4 !== 0) return;
  pointerClient.moved = false;
  if (pointer.x < -1.5) {
    tooltip.style.display = 'none';
    return;
  }
  raycaster.setFromCamera(pointer, camera);
  const hits = raycaster.intersectObjects(pickables, true);
  let info = null;
  for (const hit of hits) {
    const mat = Array.isArray(hit.object.material) ? hit.object.material[0] : hit.object.material;
    if (mat?.clippingPlanes?.length && cutPlanes.every((p) => p.distanceToPoint(hit.point) < 0)) continue;
    if (!isVisible(hit.object)) continue;
    let o = hit.object;
    while (o && !o.userData.partInfo) o = o.parent;
    if (o) {
      info = o.userData.partInfo;
      break;
    }
  }
  if (!info) {
    tooltip.style.display = 'none';
    return;
  }
  tooltip.innerHTML = `<strong>${info.title}</strong>${info.body}`;
  tooltip.style.display = 'block';
  tooltip.style.left = `${pointerClient.x + 16}px`;
  tooltip.style.top = `${pointerClient.y + 16}px`;
}

function isVisible(object) {
  for (let o = object; o; o = o.parent) if (!o.visible) return false;
  return true;
}

function animate() {
  const delta = Math.min(clock.getDelta(), 0.05);
  const elapsed = clock.elapsedTime;
  frame += 1;
  updateOpen(delta);
  updateScreen(delta);
  updateSignals(elapsed);
  updateCamera();
  controls.update();
  updateHover();
  updateLabels();
  composer.render();
  requestAnimationFrame(animate);
}

setMode('signal', true);
applyVisibility();
if (import.meta.env.DEV) window.__tv = { camera, controls, state, setMode, scene };
animate();
