import * as THREE from 'three';
import {
  createBrushedTexture,
  createCapSleeveTexture,
  createGrainTexture,
  createLaminationTexture,
  createPcbTexture,
  createResistorTexture,
  createWindingTexture,
  createWoodTextures,
} from './textures.js';
import { PCB } from './dims.js';
import { withSectionCap } from './utils.js';

/**
 * 所有材质集中创建。cutPlanes 为剖切平面数组，需要剖开的部件挂上它并带截面色。
 */
export function createMaterials(cutPlanes) {
  const wood = createWoodTextures();
  const brushed = createBrushedTexture();
  const grain = createGrainTexture();
  grain.repeat.set(8, 8);
  const winding = createWindingTexture();
  winding.repeat.set(24, 1);

  const m = {};

  // —— 外壳 ——
  m.wood = withSectionCap(
    new THREE.MeshPhysicalMaterial({
      map: wood.map,
      bumpMap: wood.bumpMap,
      bumpScale: 0.6,
      roughness: 0.46,
      clearcoat: 0.55,
      clearcoatRoughness: 0.22,
      sheen: 0.15,
    }),
    0xb48a58,
    cutPlanes,
  );

  m.bezel = new THREE.MeshPhysicalMaterial({
    color: 0x1c1d1f,
    roughness: 0.42,
    roughnessMap: grain,
    bumpMap: grain,
    bumpScale: 0.15,
    clearcoat: 0.25,
    clearcoatRoughness: 0.4,
  });

  m.backCover = new THREE.MeshStandardMaterial({
    color: 0x232221,
    roughness: 0.72,
    bumpMap: grain,
    bumpScale: 0.25,
    alphaTest: 0.5,
  });
  withSectionCap(m.backCover, 0x2f2d2b, cutPlanes);

  m.chrome = new THREE.MeshStandardMaterial({ color: 0xf2f4f6, metalness: 1, roughness: 0.08 });
  m.brassCut = withSectionCap(
    new THREE.MeshStandardMaterial({ color: 0xc9a466, metalness: 1, roughness: 0.28 }),
    0xa88848,
    cutPlanes,
  );

  m.aluminum = new THREE.MeshStandardMaterial({
    color: 0xd9dcde,
    metalness: 0.9,
    roughness: 0.34,
    roughnessMap: brushed,
  });

  m.knob = new THREE.MeshPhysicalMaterial({
    color: 0x111213,
    roughness: 0.32,
    clearcoat: 0.6,
    clearcoatRoughness: 0.18,
  });
  m.knobInsert = new THREE.MeshStandardMaterial({
    color: 0xe8eaec,
    metalness: 1,
    roughness: 0.22,
    roughnessMap: brushed,
  });
  m.knobPointer = new THREE.MeshStandardMaterial({ color: 0xf2efe6, roughness: 0.5 });

  m.grille = new THREE.MeshStandardMaterial({
    color: 0x2a2c2f,
    metalness: 0.75,
    roughness: 0.42,
    alphaTest: 0.5,
    side: THREE.DoubleSide,
  });
  m.cloth = new THREE.MeshStandardMaterial({ color: 0x191716, roughness: 1, bumpMap: grain, bumpScale: 0.6 });

  m.lamp = new THREE.MeshStandardMaterial({
    color: 0x4a0b06,
    emissive: 0xff2a12,
    emissiveIntensity: 2.6,
    roughness: 0.2,
  });

  // —— 显像管 ——
  m.screen = new THREE.MeshPhysicalMaterial({
    color: 0x1e2222,
    roughness: 0.22,
    metalness: 0,
    clearcoat: 1,
    clearcoatRoughness: 0.03,
    emissive: 0xffffff,
    emissiveIntensity: 1.0,
    envMapIntensity: 0.9,
  });
  m.screenBack = new THREE.MeshStandardMaterial({
    color: 0x9aa0a4,
    metalness: 0.85,
    roughness: 0.42,
    side: THREE.BackSide,
  });

  m.aquadag = new THREE.MeshStandardMaterial({
    color: 0x1b1d1e,
    roughness: 0.66,
    metalness: 0.22,
  });
  withSectionCap(m.aquadag, 0x2b2e2f, cutPlanes);

  m.glass = new THREE.MeshPhysicalMaterial({
    color: 0xe4f2ec,
    roughness: 0.04,
    metalness: 0,
    transparent: true,
    opacity: 0.2,
    depthWrite: false,
    side: THREE.DoubleSide,
    specularIntensity: 1,
    envMapIntensity: 1.6,
    clippingPlanes: cutPlanes,
    clipIntersection: true,
    clipShadows: true,
  });

  m.steel = new THREE.MeshStandardMaterial({
    color: 0xa3a8ad,
    metalness: 1,
    roughness: 0.36,
    roughnessMap: brushed,
  });
  m.steelCut = withSectionCap(
    new THREE.MeshStandardMaterial({ color: 0xa3a8ad, metalness: 1, roughness: 0.36 }),
    0x6f7478,
    cutPlanes,
  );
  m.tinplate = new THREE.MeshStandardMaterial({
    color: 0xcfd0c8,
    metalness: 1,
    roughness: 0.26,
    roughnessMap: brushed,
  });

  m.copper = withSectionCap(
    new THREE.MeshStandardMaterial({
      color: 0xc0743c,
      metalness: 1,
      roughness: 0.32,
      map: winding,
      bumpMap: winding,
      bumpScale: 1.4,
    }),
    0xd08850,
    cutPlanes,
  );
  m.copperPlain = new THREE.MeshStandardMaterial({ color: 0xc0743c, metalness: 1, roughness: 0.3 });
  m.ferrite = withSectionCap(
    new THREE.MeshStandardMaterial({ color: 0x2c2c2e, roughness: 0.7, metalness: 0.25, roughnessMap: grain }),
    0x404044,
    cutPlanes,
  );
  m.yokePlastic = withSectionCap(
    new THREE.MeshStandardMaterial({ color: 0x161718, roughness: 0.5 }),
    0x2a2b2c,
    cutPlanes,
  );
  m.magnetRing = withSectionCap(
    new THREE.MeshStandardMaterial({ color: 0x3a3b3d, roughness: 0.6, metalness: 0.3 }),
    0x55565a,
    cutPlanes,
  );

  m.nickel = new THREE.MeshStandardMaterial({ color: 0xb8bcbf, metalness: 1, roughness: 0.3 });
  m.bead = new THREE.MeshPhysicalMaterial({
    color: 0xf1ede2,
    roughness: 0.3,
    transmission: 0,
    sheen: 0.4,
    clearcoat: 0.6,
  });
  m.heater = new THREE.MeshBasicMaterial({ color: new THREE.Color(1.0, 0.42, 0.12).multiplyScalar(3) });

  m.rubber = new THREE.MeshPhysicalMaterial({ color: 0x6a1611, roughness: 0.55, clearcoat: 0.3 });
  m.hvCable = new THREE.MeshPhysicalMaterial({ color: 0x8c1d17, roughness: 0.45, clearcoat: 0.4 });
  m.blackPlastic = new THREE.MeshStandardMaterial({ color: 0x141414, roughness: 0.5 });
  m.epoxy = new THREE.MeshStandardMaterial({ color: 0x0f0f10, roughness: 0.38, metalness: 0.05 });

  // —— 机芯 ——
  const pcbW = PCB.maxX - PCB.minX;
  const pcbD = PCB.maxZ - PCB.minZ;
  const pcbMap = createPcbTexture(pcbW, pcbD);
  m.pcb = new THREE.MeshStandardMaterial({ map: pcbMap, roughness: 0.72 });
  m.pcbEdge = new THREE.MeshStandardMaterial({ color: 0x6d4c2a, roughness: 0.8 });
  m.pcbGreen = new THREE.MeshStandardMaterial({ color: 0x24563c, roughness: 0.55 });

  m.resistor = new THREE.MeshStandardMaterial({ map: createResistorTexture(), roughness: 0.55 });
  m.capSleeve = new THREE.MeshPhysicalMaterial({
    map: createCapSleeveTexture(),
    roughness: 0.35,
    clearcoat: 0.6,
  });
  m.capTop = new THREE.MeshStandardMaterial({ color: 0xc9ccd0, metalness: 1, roughness: 0.3 });
  m.ceramic = new THREE.MeshStandardMaterial({ color: 0xc8692b, roughness: 0.45 });
  m.choke = new THREE.MeshStandardMaterial({ color: 0x3f6b3a, roughness: 0.4 });
  m.lead = new THREE.MeshStandardMaterial({ color: 0xc6c9cc, metalness: 1, roughness: 0.25 });
  m.lamination = new THREE.MeshStandardMaterial({
    map: createLaminationTexture(),
    metalness: 0.6,
    roughness: 0.55,
  });
  m.heatsink = new THREE.MeshStandardMaterial({ color: 0x1c1d1f, metalness: 0.5, roughness: 0.48 });
  m.paper = new THREE.MeshStandardMaterial({ color: 0x24221f, roughness: 0.95, side: THREE.DoubleSide });
  m.ferriteMagnet = new THREE.MeshStandardMaterial({ color: 0x2b2b2c, roughness: 0.82 });
  m.connector = new THREE.MeshStandardMaterial({ color: 0xece6d6, roughness: 0.55 });

  m.wire = (color) => new THREE.MeshStandardMaterial({ color, roughness: 0.5 });

  return m;
}
