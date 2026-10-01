import * as THREE from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { RectAreaLightUniformsLib } from 'three/examples/jsm/lights/RectAreaLightUniformsLib.js';
import { CAB, FLOOR_Y, RASTER, SX, SY } from './dims.js';
import { createShadowTexture } from './textures.js';

const BG = 0x0b0e10;

export function buildStage(scene, renderer) {
  RectAreaLightUniformsLib.init();

  const pmrem = new THREE.PMREMGenerator(renderer);
  scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
  scene.environmentIntensity = 0.42;
  pmrem.dispose();

  scene.background = new THREE.Color(BG);
  scene.fog = new THREE.Fog(BG, 13, 30);

  const floor = new THREE.Mesh(
    new THREE.CircleGeometry(40, 96),
    new THREE.MeshStandardMaterial({ color: 0x1b1e20, roughness: 0.62, metalness: 0 }),
  );
  floor.rotation.x = -Math.PI / 2;
  floor.position.y = FLOOR_Y;
  floor.receiveShadow = true;
  scene.add(floor);

  // 接触阴影，补足环境光遮蔽
  const contact = new THREE.Mesh(
    new THREE.PlaneGeometry(6.4, 5.4),
    new THREE.MeshBasicMaterial({ map: createShadowTexture(), transparent: true, depthWrite: false, opacity: 0.85 }),
  );
  contact.rotation.x = -Math.PI / 2;
  contact.position.set(0, FLOOR_Y + 0.003, -0.4);
  scene.add(contact);

  scene.add(new THREE.HemisphereLight(0xdfe8ff, 0x1a1410, 0.22));

  const key = new THREE.DirectionalLight(0xfff0dc, 2.3);
  key.position.set(6, 9, 7);
  key.castShadow = true;
  key.shadow.mapSize.set(2048, 2048);
  const sc = key.shadow.camera;
  sc.left = -5;
  sc.right = 5;
  sc.top = 5;
  sc.bottom = -5;
  sc.near = 2;
  sc.far = 26;
  key.shadow.bias = -0.0004;
  key.shadow.normalBias = 0.02;
  scene.add(key);

  const fill = new THREE.DirectionalLight(0xa8c4ff, 0.45);
  fill.position.set(-7, 3, 5);
  scene.add(fill);

  const rim = new THREE.SpotLight(0x9fc8ff, 60, 22, 0.55, 0.85, 2);
  rim.position.set(-4.5, 5.5, -6.5);
  rim.target.position.set(0, 0.4, 0);
  scene.add(rim, rim.target);

  // 屏幕自发光照亮地面与周围
  const screenLight = new THREE.RectAreaLight(0xcfe0ff, 3, RASTER.halfW * 1.9, RASTER.halfH * 1.9);
  screenLight.position.set(SX, SY, 1.32);
  screenLight.lookAt(SX, SY, 6);
  scene.add(screenLight);

  // 剖开后用于照亮机箱内部的补光
  const interior = new THREE.PointLight(0xffe2c4, 0, 5, 1.6);
  interior.position.set(1.2, CAB.top - 0.3, -0.7);
  scene.add(interior);

  return { key, screenLight, interior };
}
