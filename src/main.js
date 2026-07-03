import './styles.css';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { createElement, icons } from 'lucide';

const canvas = document.querySelector('#scene');
const renderer = new THREE.WebGLRenderer({
  canvas,
  antialias: true,
  alpha: false,
  preserveDrawingBuffer: true,
});
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.12;

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x071013);
scene.fog = new THREE.Fog(0x071013, 16, 38);

const camera = new THREE.PerspectiveCamera(45, window.innerWidth / window.innerHeight, 0.1, 100);
camera.position.set(6.6, 3.3, 7.8);

const controls = new OrbitControls(camera, renderer.domElement);
controls.target.set(0, 0.6, 0);
controls.enableDamping = true;
controls.maxDistance = 16;
controls.minDistance = 4.5;
controls.maxPolarAngle = Math.PI * 0.48;

const raycaster = new THREE.Raycaster();
const pointer = new THREE.Vector2();
const labelLayer = document.querySelector('#labels');
const labels = [];

const state = {
  paused: false,
  mode: 'signal',
  shellTransparent: true,
  beamVisible: true,
  coilVisible: true,
  signalVisible: true,
  scanSpeed: 1.15,
  brightness: 0.95,
  noise: 0.12,
  scan: 0,
};

const groups = {
  television: new THREE.Group(),
  internals: new THREE.Group(),
  coils: new THREE.Group(),
  signals: new THREE.Group(),
  beam: new THREE.Group(),
  labels: new THREE.Group(),
};

scene.add(groups.television, groups.internals, groups.signals);
groups.internals.add(groups.coils, groups.beam);

const shellMaterial = new THREE.MeshStandardMaterial({
  color: 0x263236,
  roughness: 0.72,
  metalness: 0.05,
  transparent: true,
  opacity: 0.46,
});

const trimMaterial = new THREE.MeshStandardMaterial({
  color: 0xd6d0bd,
  roughness: 0.58,
  metalness: 0.12,
});

const darkMaterial = new THREE.MeshStandardMaterial({
  color: 0x0d1315,
  roughness: 0.88,
});

const brassMaterial = new THREE.MeshStandardMaterial({
  color: 0xc89447,
  roughness: 0.42,
  metalness: 0.55,
});

const glassMaterial = new THREE.MeshPhysicalMaterial({
  color: 0x8fffd1,
  roughness: 0.05,
  metalness: 0,
  transmission: 0.38,
  thickness: 0.22,
  transparent: true,
  opacity: 0.44,
  emissive: 0x154b35,
  emissiveIntensity: 0.2,
});

const phosphorMaterial = new THREE.MeshBasicMaterial({
  color: 0x88ffc8,
  transparent: true,
  opacity: 1,
});

const copperMaterial = new THREE.MeshStandardMaterial({
  color: 0xc0773a,
  roughness: 0.32,
  metalness: 0.45,
  emissive: 0x241008,
});

const redBeamMaterial = new THREE.LineBasicMaterial({
  color: 0xff705d,
  transparent: true,
  opacity: 0.95,
  blending: THREE.AdditiveBlending,
});

const cyanMaterial = new THREE.MeshBasicMaterial({
  color: 0x66d8f0,
  transparent: true,
  opacity: 0.72,
});

const amberMaterial = new THREE.MeshBasicMaterial({
  color: 0xf2b15e,
  transparent: true,
  opacity: 0.78,
});

const screenTexture = createScreenTexture();
const scopes = createScopes();

buildLights();
buildRoom();
buildTelevision();
buildInternals();
buildSignalFlow();
buildLabels();
buildUI();

const clock = new THREE.Clock();
let beamLine;
let beamGlow;
let scanSpot;
let hovered = null;

createBeamObjects();
setMode('signal', true);
applyVisibility();

function buildLights() {
  scene.add(new THREE.HemisphereLight(0xb9fff0, 0x111315, 1.1));

  const key = new THREE.DirectionalLight(0xffffff, 2.6);
  key.position.set(5, 7, 4);
  scene.add(key);

  const rim = new THREE.PointLight(0x66d8f0, 12, 14);
  rim.position.set(-4.6, 2.2, -3.5);
  scene.add(rim);

  const screenGlow = new THREE.PointLight(0x73f6b4, 5.5, 8);
  screenGlow.position.set(0, 0.8, 2.2);
  scene.add(screenGlow);
}

function buildRoom() {
  const floor = new THREE.Mesh(
    new THREE.PlaneGeometry(28, 28),
    new THREE.MeshStandardMaterial({
      color: 0x11191b,
      roughness: 0.84,
      metalness: 0.02,
    }),
  );
  floor.rotation.x = -Math.PI / 2;
  floor.position.y = -1.45;
  scene.add(floor);

  const grid = new THREE.GridHelper(24, 24, 0x315055, 0x172326);
  grid.position.y = -1.435;
  grid.material.transparent = true;
  grid.material.opacity = 0.28;
  scene.add(grid);
}

function buildTelevision() {
  const cabinet = new THREE.Mesh(new RoundedBoxGeometry(4.6, 3.15, 2.6, 7, 0.22), shellMaterial);
  cabinet.position.set(0, 0.15, 0);
  cabinet.name = '外壳';
  groups.television.add(cabinet);

  const face = new THREE.Mesh(new RoundedBoxGeometry(4.78, 3.28, 0.34, 6, 0.18), trimMaterial);
  face.position.set(0, 0.15, 1.32);
  groups.television.add(face);

  const screenFrame = new THREE.Mesh(new RoundedBoxGeometry(3.18, 2.28, 0.18, 6, 0.15), darkMaterial);
  screenFrame.position.set(-0.45, 0.28, 1.53);
  groups.television.add(screenFrame);

  const screen = new THREE.Mesh(new RoundedBoxGeometry(2.78, 1.88, 0.08, 8, 0.12), phosphorMaterial);
  screen.position.set(-0.45, 0.28, 1.64);
  screen.material.map = screenTexture.texture;
  screen.material.needsUpdate = true;
  groups.television.add(screen);

  const glass = new THREE.Mesh(new RoundedBoxGeometry(2.92, 2.02, 0.06, 8, 0.13), glassMaterial);
  glass.position.set(-0.45, 0.28, 1.69);
  groups.television.add(glass);

  const speaker = new THREE.Group();
  for (let i = 0; i < 9; i += 1) {
    const y = -0.55 + i * 0.14;
    const slot = new THREE.Mesh(new RoundedBoxGeometry(0.7, 0.045, 0.08, 3, 0.02), darkMaterial);
    slot.position.set(1.58, y, 1.56);
    speaker.add(slot);
  }
  groups.television.add(speaker);

  for (let i = 0; i < 2; i += 1) {
    const knob = new THREE.Mesh(new THREE.CylinderGeometry(0.26, 0.26, 0.16, 32), brassMaterial);
    knob.rotation.x = Math.PI / 2;
    knob.position.set(1.56, 0.82 - i * 0.58, 1.66);
    groups.television.add(knob);

    const indicator = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.15, 0.025), darkMaterial);
    indicator.position.set(1.56, 0.82 - i * 0.58 + 0.1, 1.76);
    groups.television.add(indicator);
  }

  const footGeometry = new THREE.CylinderGeometry(0.18, 0.25, 0.46, 12);
  for (const x of [-1.55, 1.45]) {
    const foot = new THREE.Mesh(footGeometry, darkMaterial);
    foot.position.set(x, -1.45, 0.54);
    foot.rotation.z = x < 0 ? -0.12 : 0.12;
    groups.television.add(foot);
  }

  const antennaMat = new THREE.MeshStandardMaterial({ color: 0xcbd5d1, metalness: 0.7, roughness: 0.2 });
  for (const side of [-1, 1]) {
    const antenna = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.018, 2.5, 12), antennaMat);
    antenna.position.set(side * 0.55, 2.25, -0.4);
    antenna.rotation.z = side * 0.58;
    groups.television.add(antenna);
  }
}

function buildInternals() {
  const tube = new THREE.Mesh(createTubeFunnelGeometry(), glassMaterial.clone());
  tube.material.opacity = 0.23;
  tube.material.emissiveIntensity = 0.08;
  tube.rotation.y = Math.PI / 2;
  tube.position.set(-0.45, 0.28, 0.24);
  groups.internals.add(tube);

  const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.24, 0.24, 1.05, 36), glassMaterial.clone());
  neck.material.opacity = 0.28;
  neck.rotation.x = Math.PI / 2;
  neck.position.set(-0.45, 0.28, -0.94);
  groups.internals.add(neck);

  const gunGroup = new THREE.Group();
  const cathode = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.16, 0.36, 24), brassMaterial);
  cathode.rotation.x = Math.PI / 2;
  cathode.position.z = -1.52;
  gunGroup.add(cathode);

  const heater = new THREE.Mesh(new THREE.TorusGeometry(0.15, 0.015, 8, 40), amberMaterial);
  heater.position.z = -1.3;
  heater.rotation.x = Math.PI / 2;
  gunGroup.add(heater);

  const focus = new THREE.Mesh(new THREE.CylinderGeometry(0.23, 0.23, 0.14, 28), darkMaterial);
  focus.rotation.x = Math.PI / 2;
  focus.position.z = -1.02;
  gunGroup.add(focus);

  gunGroup.position.set(-0.45, 0.28, 0);
  gunGroup.name = '电子枪';
  groups.internals.add(gunGroup);

  const yoke = new THREE.Group();
  const coilA = createCoil(0x66d8f0, 0);
  const coilB = createCoil(0xf2b15e, Math.PI / 2);
  yoke.add(coilA, coilB);
  yoke.position.set(-0.45, 0.28, -0.53);
  groups.coils.add(yoke);

  const board = new THREE.Mesh(
    new RoundedBoxGeometry(1.55, 0.92, 0.08, 3, 0.03),
    new THREE.MeshStandardMaterial({ color: 0x173e37, roughness: 0.76, metalness: 0.05 }),
  );
  board.position.set(1.05, -0.58, -0.7);
  board.rotation.x = -0.18;
  groups.internals.add(board);

  for (let i = 0; i < 8; i += 1) {
    const component = new THREE.Mesh(
      new THREE.BoxGeometry(0.12 + (i % 3) * 0.05, 0.11, 0.16),
      new THREE.MeshStandardMaterial({
        color: [0x55706b, 0xc89447, 0x1f86a1][i % 3],
        roughness: 0.58,
      }),
    );
    component.position.set(0.47 + (i % 4) * 0.28, -0.48 - Math.floor(i / 4) * 0.2, -0.58);
    groups.internals.add(component);
  }
}

function createTubeFunnelGeometry() {
  const points = [
    new THREE.Vector2(0.22, -1.25),
    new THREE.Vector2(0.31, -0.86),
    new THREE.Vector2(0.78, -0.2),
    new THREE.Vector2(1.04, 0.35),
    new THREE.Vector2(1.08, 0.78),
  ];
  return new THREE.LatheGeometry(points, 48);
}

function createCoil(color, rotation) {
  const coil = new THREE.Group();
  const material = new THREE.MeshStandardMaterial({
    color,
    roughness: 0.2,
    metalness: 0.42,
    emissive: color,
    emissiveIntensity: 0.08,
  });
  for (let i = 0; i < 4; i += 1) {
    const torus = new THREE.Mesh(new THREE.TorusGeometry(0.47 + i * 0.035, 0.018, 12, 70), material);
    torus.rotation.y = Math.PI / 2;
    torus.rotation.z = rotation;
    torus.scale.x = 0.68;
    coil.add(torus);
  }
  return coil;
}

function buildSignalFlow() {
  const points = [
    new THREE.Vector3(-1.2, 2.56, -0.36),
    new THREE.Vector3(-0.15, 1.88, -0.55),
    new THREE.Vector3(0.95, 0.05, -0.68),
    new THREE.Vector3(-0.45, 0.28, -1.22),
    new THREE.Vector3(-0.45, 0.28, 1.58),
  ];

  const material = new THREE.LineBasicMaterial({
    color: 0x73f6b4,
    transparent: true,
    opacity: 0.54,
    linewidth: 2,
  });

  for (let i = 0; i < points.length - 1; i += 1) {
    const curve = new THREE.CatmullRomCurve3([points[i], points[i].clone().lerp(points[i + 1], 0.5), points[i + 1]]);
    const geometry = new THREE.BufferGeometry().setFromPoints(curve.getPoints(38));
    groups.signals.add(new THREE.Line(geometry, material));
  }

  const pulseGeometry = new THREE.SphereGeometry(0.06, 18, 18);
  for (let i = 0; i < 6; i += 1) {
    const pulse = new THREE.Mesh(pulseGeometry, cyanMaterial.clone());
    pulse.userData.path = points;
    pulse.userData.offset = i / 6;
    groups.signals.add(pulse);
  }

  const stagePositions = [
    new THREE.Vector3(-1.2, 2.3, -0.36),
    new THREE.Vector3(0.95, -0.22, -0.68),
    new THREE.Vector3(-0.45, 0.28, -1.22),
    new THREE.Vector3(-0.45, 0.28, -0.53),
    new THREE.Vector3(-0.45, 0.28, 1.58),
  ];
  for (let i = 0; i < stagePositions.length; i += 1) {
    const marker = new THREE.Mesh(
      new THREE.SphereGeometry(0.075, 18, 18),
      new THREE.MeshBasicMaterial({
        color: [0x66d8f0, 0xf2b15e, 0x73f6b4, 0xff705d, 0xeafff5][i],
        transparent: true,
        opacity: 0.9,
        blending: THREE.AdditiveBlending,
      }),
    );
    marker.position.copy(stagePositions[i]);
    marker.userData.stageMarker = true;
    marker.userData.stageIndex = i;
    groups.signals.add(marker);
  }
}

function buildLabels() {
  addLabel('天线接收', '把无线电波转成微弱电信号', new THREE.Vector3(-1.55, 2.45, -0.4));
  addLabel('调谐与放大', '选台后放大图像和同步信号', new THREE.Vector3(1.15, -0.4, -0.72));
  addLabel('电子枪', '阴极受热后发射电子束', new THREE.Vector3(1.02, 0.96, -1.22));
  addLabel('偏转线圈', '磁场让电子束水平、垂直偏转', new THREE.Vector3(-1.15, 0.9, -0.52));
  addLabel('荧光屏', '电子撞击荧光粉形成亮点和余辉', new THREE.Vector3(-1.42, 1.25, 1.75));
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
  textureCanvas.width = 512;
  textureCanvas.height = 360;
  const ctx = textureCanvas.getContext('2d', { willReadFrequently: true });
  const reference = document.createElement('canvas');
  reference.width = textureCanvas.width;
  reference.height = textureCanvas.height;
  const referenceCtx = reference.getContext('2d');
  const image = referenceCtx.createImageData(reference.width, reference.height);
  for (let y = 0; y < reference.height; y += 1) {
    for (let x = 0; x < reference.width; x += 1) {
      const signal = sampleVideoSignal(x / reference.width, y / reference.height);
      const index = (y * reference.width + x) * 4;
      image.data[index] = 34 + signal * 80;
      image.data[index + 1] = 80 + signal * 170;
      image.data[index + 2] = 72 + signal * 104;
      image.data[index + 3] = 255;
    }
  }
  referenceCtx.putImageData(image, 0, 0);
  const texture = new THREE.CanvasTexture(textureCanvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return { canvas: textureCanvas, ctx, texture, reference, decay: 0.88 };
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
  const geometry = new THREE.BufferGeometry().setFromPoints([
    new THREE.Vector3(-0.45, 0.28, -1.38),
    new THREE.Vector3(-0.45, 0.28, 1.58),
  ]);
  beamLine = new THREE.Line(geometry, redBeamMaterial);
  groups.beam.add(beamLine);

  beamGlow = new THREE.Mesh(
    new THREE.SphereGeometry(0.045, 18, 18),
    new THREE.MeshBasicMaterial({
      color: 0xff806f,
      transparent: true,
      opacity: 0.92,
      blending: THREE.AdditiveBlending,
    }),
  );
  groups.beam.add(beamGlow);

  scanSpot = new THREE.PointLight(0xff705d, 1.8, 2.2);
  groups.beam.add(scanSpot);
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

  bindCheckbox('#shellTransparent', 'shellTransparent');
  bindCheckbox('#beamVisible', 'beamVisible');
  bindCheckbox('#coilVisible', 'coilVisible');
  bindCheckbox('#signalVisible', 'signalVisible');
  bindRange('#scanSpeed', 'scanSpeed');
  bindRange('#brightness', 'brightness');
  bindRange('#noise', 'noise');

  window.addEventListener('resize', onResize);
  window.addEventListener('pointermove', onPointerMove);
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

function setMode(mode, force = false) {
  state.mode = mode;
  for (const button of document.querySelectorAll('.mode-button')) {
    button.classList.toggle('is-active', button.dataset.mode === mode);
  }

  const cameraTargets = {
    overview: { position: [6.6, 3.3, 7.8], target: [0, 0.6, 0] },
    inside: { position: [3.65, 2.15, 4.55], target: [-0.34, 0.24, -0.08] },
    signal: { position: [4.85, 2.55, 5.75], target: [-0.32, 0.62, 0.1] },
    screen: { position: [-0.55, 0.38, 5.18], target: [-0.45, 0.28, 1.42] },
  };
  const next = cameraTargets[mode];
  if (force) {
    camera.position.fromArray(next.position);
    controls.target.fromArray(next.target);
    controls.update();
    return;
  }
  camera.userData.destination = {
    position: new THREE.Vector3().fromArray(next.position),
    target: new THREE.Vector3().fromArray(next.target),
  };

  if (mode === 'inside' || mode === 'signal') {
    state.shellTransparent = true;
    document.querySelector('#shellTransparent').checked = true;
  }
  applyVisibility();
}

function applyVisibility() {
  shellMaterial.opacity = state.shellTransparent ? 0.38 : 1;
  shellMaterial.transparent = state.shellTransparent;
  groups.internals.visible = state.shellTransparent || state.mode === 'inside';
  groups.beam.visible = state.beamVisible && groups.internals.visible;
  groups.coils.visible = state.coilVisible && groups.internals.visible;
  groups.signals.visible = state.signalVisible;
  labelLayer.style.display = state.signalVisible ? 'block' : 'none';
}

function onResize() {
  const width = window.innerWidth;
  const height = window.innerHeight;
  camera.aspect = width / height;
  camera.updateProjectionMatrix();
  renderer.setSize(width, height);
}

function onPointerMove(event) {
  pointer.x = (event.clientX / window.innerWidth) * 2 - 1;
  pointer.y = -(event.clientY / window.innerHeight) * 2 + 1;
}

function updateScreen(delta) {
  const { canvas: textureCanvas, ctx, texture, reference } = screenTexture;
  const width = textureCanvas.width;
  const height = textureCanvas.height;

  ctx.globalCompositeOperation = 'source-over';
  ctx.globalAlpha = 1;
  ctx.fillStyle = 'rgba(2, 13, 9, 0.045)';
  ctx.fillRect(0, 0, width, height);
  ctx.globalAlpha = 0.12 * state.brightness;
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

  ctx.fillStyle = `rgba(115, 246, 180, ${0.08 * state.brightness})`;
  for (let scanY = 0; scanY < height; scanY += 4) {
    ctx.fillRect(0, scanY, width, 1);
  }

  ctx.globalCompositeOperation = 'lighter';
  for (let px = 0; px <= x; px += 2.6) {
    const u = px / width;
    const v = y / height;
    const value = sampleVideoSignal(u, v);
    const green = Math.round(78 + value * 168 * state.brightness);
    const alpha = 0.2 + value * 0.6 * state.brightness;
    ctx.fillStyle = `rgba(108, ${green}, 176, ${alpha})`;
    ctx.fillRect(px, y - 1.2, 3.6, 2.4);
  }

  const rawSignal = sampleVideoSignal(x / width, y / height);
  const signal = clamp(rawSignal + (Math.random() - 0.5) * state.noise * 0.65, 0, 1);
  const jitter = (Math.random() - 0.5) * width * state.noise * 0.4;
  const gradient = ctx.createRadialGradient(x + jitter, y, 3, x + jitter, y, 92);
  gradient.addColorStop(0, `rgba(235, 255, 235, ${0.35 + 0.65 * signal * state.brightness})`);
  gradient.addColorStop(0.2, `rgba(115, 246, 180, ${0.18 + 0.65 * state.brightness * signal})`);
  gradient.addColorStop(1, 'rgba(115, 246, 180, 0)');
  ctx.fillStyle = gradient;
  ctx.beginPath();
  ctx.arc(x + jitter, y, 96, 0, Math.PI * 2);
  ctx.fill();

  ctx.strokeStyle = `rgba(235, 255, 235, ${0.78 * state.brightness})`;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(0, y);
  ctx.lineTo(x + jitter, y);
  ctx.stroke();

  for (let i = 0; i < Math.round(30 * state.noise); i += 1) {
    ctx.fillStyle = `rgba(255, 255, 255, ${Math.random() * 0.25})`;
    ctx.fillRect(Math.random() * width, Math.random() * height, 1 + Math.random() * 4, 1);
  }

  texture.needsUpdate = true;

  const sx = (x / width - 0.5) * 2.42;
  const sy = -(y / height - 0.5) * 1.62;
  updateBeam(sx - 0.45, sy + 0.28, x / width, y / height, signal);
  updateScopes(x / width, y / height, signal, currentLine, lineCount);
  updateConversionReadout(x / width, y / height, signal);
}

function sampleVideoSignal(u, v) {
  const border = u < 0.045 || u > 0.955 || v < 0.06 || v > 0.94 ? 0.8 : 0.08;
  const bars = v < 0.22 ? 0.18 + (Math.floor(u * 7) % 2) * 0.58 + u * 0.18 : 0;
  const dx = u - 0.5;
  const dy = (v - 0.52) * 1.35;
  const dist = Math.sqrt(dx * dx + dy * dy);
  const circle = Math.abs(dist - 0.27) < 0.025 ? 0.95 : 0;
  const center = dist < 0.17 ? 0.48 + 0.32 * Math.sin(u * Math.PI * 8) : 0;
  const diagonal = Math.abs(v - (0.82 - u * 0.42)) < 0.018 ? 0.88 : 0;
  const block = u > 0.12 && u < 0.32 && v > 0.58 && v < 0.82 ? 0.68 : 0;
  const stair = u > 0.64 && u < 0.86 && v > 0.42 && v < 0.75 ? (Math.floor((v - 0.42) * 18) % 2 ? 0.3 : 0.82) : 0;
  return clamp(Math.max(border, bars, circle, center, diagonal, block, stair), 0.04, 1);
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function updateBeam(screenX, screenY, horizontal, vertical, signal) {
  const start = new THREE.Vector3(-0.45, 0.28, -1.38);
  const control = new THREE.Vector3(-0.45 + (screenX + 0.45) * 0.22, 0.28 + (screenY - 0.28) * 0.22, -0.25);
  const end = new THREE.Vector3(screenX, screenY, 1.57);
  const curve = new THREE.QuadraticBezierCurve3(start, control, end);
  beamLine.geometry.setFromPoints(curve.getPoints(30));
  redBeamMaterial.opacity = 0.32 + signal * 0.68;
  beamGlow.position.copy(end);
  beamGlow.scale.setScalar(0.7 + signal * 1.45);
  scanSpot.position.copy(end);
  scanSpot.intensity = 0.55 + signal * 2.4;

  document.querySelector('#horizontalMeter').style.width = `${horizontal * 100}%`;
  document.querySelector('#verticalMeter').style.width = `${vertical * 100}%`;
  document.querySelector('#videoMeter').style.width = `${signal * 100}%`;
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

  const imageW = w - 8;
  const imageH = h - 8;
  const offsetX = 4;
  const offsetY = 4;
  for (let y = 0; y < imageH; y += 2) {
    for (let x = 0; x < imageW; x += 2) {
      const value = sampleVideoSignal(x / imageW, y / imageH);
      const green = Math.round(58 + value * 190);
      scopeCtx.fillStyle = `rgba(80, ${green}, 144, ${0.5 + value * 0.42})`;
      scopeCtx.fillRect(offsetX + x, offsetY + y, 2, 2);
    }
  }

  const beamX = offsetX + horizontal * imageW;
  const beamY = offsetY + vertical * imageH;
  scopeCtx.strokeStyle = 'rgba(255, 255, 255, 0.55)';
  scopeCtx.lineWidth = 1;
  scopeCtx.beginPath();
  scopeCtx.moveTo(offsetX, beamY);
  scopeCtx.lineTo(offsetX + imageW, beamY);
  scopeCtx.moveTo(beamX, offsetY);
  scopeCtx.lineTo(beamX, offsetY + imageH);
  scopeCtx.stroke();

  const signal = sampleVideoSignal(horizontal, vertical);
  scopeCtx.fillStyle = `rgba(235, 255, 235, ${0.65 + signal * 0.35})`;
  scopeCtx.beginPath();
  scopeCtx.arc(beamX, beamY, 3.2 + signal * 3, 0, Math.PI * 2);
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

function updateConversionReadout(horizontal, vertical, signal) {
  const stepNames = ['receive', 'demod', 'video', 'sync', 'paint'];
  const index = Math.min(stepNames.length - 1, Math.floor((state.scan * stepNames.length * 1.7) % stepNames.length));
  for (const step of document.querySelectorAll('.step')) {
    step.classList.toggle('is-active', step.dataset.step === stepNames[index]);
  }

  const syncText = horizontal < 0.08 || vertical < 0.035 ? '同步脉冲正在校准扫描起点' : '亮度信号正在调制电子束强弱';
  document.querySelector('#explainText').textContent =
    `当前位置 x=${Math.round(horizontal * 100)}%, y=${Math.round(vertical * 100)}%；视频亮度=${Math.round(signal * 100)}%。${syncText}，屏幕上对应亮点随之变亮或变暗。`;
}

function updateSignals(elapsed) {
  const pulses = groups.signals.children.filter((child) => child.isMesh && child.userData.path);
  for (const pulse of pulses) {
    const path = pulse.userData.path;
    const t = (elapsed * 0.16 + pulse.userData.offset) % 1;
    const scaled = t * (path.length - 1);
    const index = Math.min(path.length - 2, Math.floor(scaled));
    const local = scaled - index;
    pulse.position.copy(path[index]).lerp(path[index + 1], local);
    pulse.scale.setScalar(0.72 + Math.sin((t + pulse.userData.offset) * Math.PI * 2) * 0.22);
  }

  const activeStage = Math.floor((state.scan * 5 * 1.7) % 5);
  const markers = groups.signals.children.filter((child) => child.userData.stageMarker);
  for (const marker of markers) {
    const isActive = marker.userData.stageIndex === activeStage;
    marker.scale.setScalar(isActive ? 1.75 + Math.sin(elapsed * 8) * 0.18 : 1);
    marker.material.opacity = isActive ? 1 : 0.46;
  }

  for (let i = 0; i < groups.coils.children.length; i += 1) {
    groups.coils.children[i].rotation.z = Math.sin(elapsed * 1.8 + i) * 0.05;
  }
}

function updateLabels() {
  for (const label of labels) {
    const pos = label.position.clone().project(camera);
    const visible = pos.z > -1 && pos.z < 1;
    label.el.style.display = visible ? 'block' : 'none';
    if (!visible) continue;
    label.el.style.left = `${(pos.x * 0.5 + 0.5) * window.innerWidth}px`;
    label.el.style.top = `${(-pos.y * 0.5 + 0.5) * window.innerHeight}px`;
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
  raycaster.setFromCamera(pointer, camera);
  const targets = [...groups.television.children, ...groups.internals.children, ...groups.coils.children];
  const hits = raycaster.intersectObjects(targets, true);
  if (hovered?.material?.emissive) hovered.material.emissiveIntensity = hovered.userData.baseEmissive ?? 0;
  hovered = hits[0]?.object ?? null;
  if (hovered?.material?.emissive) {
    hovered.userData.baseEmissive = hovered.userData.baseEmissive ?? hovered.material.emissiveIntensity;
    hovered.material.emissiveIntensity = 0.26;
  }
}

function animate() {
  const delta = Math.min(clock.getDelta(), 0.04);
  const elapsed = clock.elapsedTime;
  updateScreen(delta);
  updateSignals(elapsed);
  updateCamera();
  updateHover();
  controls.update();
  updateLabels();
  renderer.render(scene, camera);
  requestAnimationFrame(animate);
}

animate();
