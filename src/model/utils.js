import * as THREE from 'three';

export function mulberry32(seed) {
  let s = seed;
  return function random() {
    s |= 0;
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// 按弧长均匀采样的超椭圆环（从 +x 开始逆时针），返回 count 个 [x, y]。
export function superellipseRing(a, b, n, count) {
  const fine = 1024;
  const pts = [];
  const e = 2 / n;
  for (let i = 0; i <= fine; i += 1) {
    const th = (i / fine) * Math.PI * 2;
    const c = Math.cos(th);
    const s = Math.sin(th);
    pts.push([a * Math.sign(c) * Math.abs(c) ** e, b * Math.sign(s) * Math.abs(s) ** e]);
  }
  const lengths = [0];
  for (let i = 1; i < pts.length; i += 1) {
    lengths.push(lengths[i - 1] + Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]));
  }
  const total = lengths[lengths.length - 1];
  const out = [];
  let k = 0;
  for (let j = 0; j < count; j += 1) {
    const target = (j / count) * total;
    while (k < lengths.length - 2 && lengths[k + 1] < target) k += 1;
    const f = (target - lengths[k]) / Math.max(1e-9, lengths[k + 1] - lengths[k]);
    out.push([pts[k][0] + (pts[k + 1][0] - pts[k][0]) * f, pts[k][1] + (pts[k + 1][1] - pts[k][1]) * f]);
  }
  return out;
}

export function superellipseShape(a, b, n, cx = 0, cy = 0, count = 160, reverse = false) {
  const ring = superellipseRing(a, b, n, count).map(([x, y]) => new THREE.Vector2(cx + x, cy + y));
  if (reverse) ring.reverse();
  return ring;
}

export function roundedRectPoints(x0, y0, x1, y1, r, steps = 6) {
  const pts = [];
  const corners = [
    [x1 - r, y0 + r, -Math.PI / 2],
    [x1 - r, y1 - r, 0],
    [x0 + r, y1 - r, Math.PI / 2],
    [x0 + r, y0 + r, Math.PI],
  ];
  for (const [cx, cy, start] of corners) {
    for (let i = 0; i <= steps; i += 1) {
      const a = start + (i / steps) * (Math.PI / 2);
      pts.push(new THREE.Vector2(cx + Math.cos(a) * r, cy + Math.sin(a) * r));
    }
  }
  return pts;
}

export function roundedRectShape(x0, y0, x1, y1, r, steps = 6) {
  return new THREE.Shape(roundedRectPoints(x0, y0, x1, y1, r, steps));
}

/**
 * 沿 z 方向放样一组超椭圆截面。
 * station: { z | zAt(x, y), a, b, n, cx, cy }
 * 返回的几何体 uv.x 为周长比例，uv.y 为沿长度的比例（按实际距离）。
 */
export function loftGeometry(stations, segments = 128, { capEnd = false, capStart = false } = {}) {
  const rings = stations.map((st) => {
    const ring = superellipseRing(st.a, st.b, st.n ?? 2, segments);
    return ring.map(([x, y]) => {
      const px = (st.cx ?? 0) + x;
      const py = (st.cy ?? 0) + y;
      const pz = st.zAt ? st.zAt(px, py) : st.z;
      return new THREE.Vector3(px, py, pz);
    });
  });

  const along = [0];
  for (let i = 1; i < rings.length; i += 1) {
    let d = 0;
    for (let j = 0; j < segments; j += 8) d += rings[i][j].distanceTo(rings[i - 1][j]);
    along.push(along[i - 1] + d / Math.ceil(segments / 8));
  }
  const totalAlong = along[along.length - 1] || 1;

  const positions = [];
  const uvs = [];
  for (let i = 0; i < rings.length; i += 1) {
    for (let j = 0; j <= segments; j += 1) {
      const p = rings[i][j % segments];
      positions.push(p.x, p.y, p.z);
      uvs.push(j / segments, along[i] / totalAlong);
    }
  }

  const z0 = rings[0][0].z;
  const z1 = rings[rings.length - 1][0].z;
  const flip = z1 < z0;
  const indices = [];
  const row = segments + 1;
  for (let i = 0; i < rings.length - 1; i += 1) {
    for (let j = 0; j < segments; j += 1) {
      const a = i * row + j;
      const b = a + 1;
      const c = a + row;
      const d = c + 1;
      if (flip) indices.push(a, c, b, b, c, d);
      else indices.push(a, b, c, b, d, c);
    }
  }

  const addCap = (ringIndex, st, facingPositive) => {
    const centerIndex = positions.length / 3;
    const ring = rings[ringIndex];
    const cz = ring.reduce((sum, p) => sum + p.z, 0) / ring.length;
    positions.push(st.cx ?? 0, st.cy ?? 0, cz);
    uvs.push(0.5, ringIndex === 0 ? 0 : 1);
    const base = ringIndex * row;
    for (let j = 0; j < segments; j += 1) {
      if (facingPositive) indices.push(centerIndex, base + j, base + j + 1);
      else indices.push(centerIndex, base + j + 1, base + j);
    }
  };
  if (capEnd) addCap(rings.length - 1, stations[stations.length - 1], !flip);
  if (capStart) addCap(0, stations[0], flip);

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  fixSeamNormals(geometry, rings.length, segments);
  return geometry;
}

function fixSeamNormals(geometry, ringCount, segments) {
  const normal = geometry.attributes.normal;
  const row = segments + 1;
  const v = new THREE.Vector3();
  for (let i = 0; i < ringCount; i += 1) {
    const a = i * row;
    const b = a + segments;
    v.set(normal.getX(a) + normal.getX(b), normal.getY(a) + normal.getY(b), normal.getZ(a) + normal.getZ(b)).normalize();
    normal.setXYZ(a, v.x, v.y, v.z);
    normal.setXYZ(b, v.x, v.y, v.z);
  }
}

// 按法线主方向做盒式投影 UV，木纹沿长边方向。
export function boxProjectUV(geometry, scale = 1) {
  const g = geometry.index ? geometry.toNonIndexed() : geometry;
  g.computeVertexNormals();
  const pos = g.attributes.position;
  const nor = g.attributes.normal;
  const uv = new Float32Array(pos.count * 2);
  for (let i = 0; i < pos.count; i += 3) {
    // 每个三角形使用同一投影，避免拉伸
    const nx = Math.abs(nor.getX(i) + nor.getX(i + 1) + nor.getX(i + 2));
    const ny = Math.abs(nor.getY(i) + nor.getY(i + 1) + nor.getY(i + 2));
    const nz = Math.abs(nor.getZ(i) + nor.getZ(i + 1) + nor.getZ(i + 2));
    for (let k = 0; k < 3; k += 1) {
      const x = pos.getX(i + k);
      const y = pos.getY(i + k);
      const z = pos.getZ(i + k);
      let u;
      let w;
      if (ny >= nx && ny >= nz) {
        u = x;
        w = z;
      } else if (nx >= nz) {
        u = z;
        w = y;
      } else {
        u = x;
        w = y;
      }
      uv[(i + k) * 2] = u * scale;
      uv[(i + k) * 2 + 1] = w * scale;
    }
  }
  g.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  return g;
}

/**
 * 剖切截面着色：开启双面渲染，背面（即被剖开后露出的内部）用指定颜色绘制，
 * 让被裁切的实体看起来是实心截面。多个剖切面取交集（切掉一个象限）。
 */
export function withSectionCap(material, capColor, clippingPlanes) {
  material.side = THREE.DoubleSide;
  material.clippingPlanes = clippingPlanes;
  material.clipIntersection = true;
  material.clipShadows = true;
  const color = new THREE.Color(capColor);
  material.userData.capColor = color;
  material.onBeforeCompile = (shader) => {
    shader.uniforms.capColor = { value: color };
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', '#include <common>\nuniform vec3 capColor;')
      .replace(
        '#include <color_fragment>',
        '#include <color_fragment>\n\tif ( ! gl_FrontFacing ) diffuseColor.rgb = capColor;',
      );
  };
  material.customProgramCacheKey = () => 'section-cap';
  return material;
}

export function tube(points, radius, material, { segments = 64, radial = 10, closed = false } = {}) {
  const curve = new THREE.CatmullRomCurve3(points, closed, 'centripetal');
  return new THREE.Mesh(new THREE.TubeGeometry(curve, segments, radius, radial, closed), material);
}

export function ribbon(points, width, thickness, material, steps = 80) {
  const curve = new THREE.CatmullRomCurve3(points);
  const shape = new THREE.Shape();
  shape.moveTo(-thickness / 2, -width / 2);
  shape.lineTo(thickness / 2, -width / 2);
  shape.lineTo(thickness / 2, width / 2);
  shape.lineTo(-thickness / 2, width / 2);
  shape.closePath();
  return new THREE.Mesh(new THREE.ExtrudeGeometry(shape, { steps, bevelEnabled: false, extrudePath: curve }), material);
}

// 旋钮：车削轮廓 + 侧面防滑齿
export function knobGeometry({ radius, height, ridges = 36, ridgeDepth = 0.06, skirt = 1.12, segments = ridges * 6 }) {
  const r = radius;
  const h = height;
  const profile = [
    [0, 0],
    [r * skirt, 0],
    [r * skirt, h * 0.08],
    [r * skirt * 0.985, h * 0.16],
    [r, h * 0.22],
    [r, h * 0.26],
    [r, h * 0.78],
    [r, h * 0.82],
    [r * 0.97, h * 0.92],
    [r * 0.9, h * 0.985],
    [r * 0.82, h],
    [0, h],
  ].map(([x, y]) => new THREE.Vector2(x, y));
  const g = new THREE.LatheGeometry(profile, segments);
  const pos = g.attributes.position;
  for (let i = 0; i < pos.count; i += 1) {
    const x = pos.getX(i);
    const y = pos.getY(i);
    const z = pos.getZ(i);
    if (y > h * 0.25 && y < h * 0.79) {
      const ang = Math.atan2(z, x);
      const wave = Math.cos(ang * ridges);
      const k = 1 - ridgeDepth * 0.5 + ridgeDepth * 0.5 * Math.sign(wave) * Math.min(1, Math.abs(wave) * 3);
      pos.setX(i, x * k);
      pos.setZ(i, z * k);
    }
  }
  g.computeVertexNormals();
  return g;
}

export function smoothstep(e0, e1, x) {
  const t = Math.min(1, Math.max(0, (x - e0) / (e1 - e0)));
  return t * t * (3 - 2 * t);
}
