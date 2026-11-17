import * as THREE from "https://cdn.jsdelivr.net/npm/three@0.170.0/build/three.module.js";

const DICE = [
  { id: "d4", sides: 4 },
  { id: "d6", sides: 6 },
  { id: "d8", sides: 8 },
  { id: "d10", sides: 10 },
  { id: "d12", sides: 12 },
  { id: "d20", sides: 20 },
  { id: "d100", sides: 100 },
];

const glyphs = {
  d4: `<svg viewBox="0 0 64 64" aria-hidden="true"><path d="M32 8 L54 50 H10 Z" fill="#24262e" stroke="#e4c56a" stroke-width="2.2" stroke-linejoin="round"/></svg>`,
  d6: `<svg viewBox="0 0 64 64" aria-hidden="true"><rect x="12" y="12" width="40" height="40" rx="6" fill="#24262e" stroke="#e4c56a" stroke-width="2.2"/></svg>`,
  d8: `<svg viewBox="0 0 64 64" aria-hidden="true"><path d="M32 6 L56 32 L32 58 L8 32 Z" fill="#24262e" stroke="#e4c56a" stroke-width="2.2" stroke-linejoin="round"/></svg>`,
  d10: `<svg viewBox="0 0 64 64" aria-hidden="true"><path d="M32 6 L54 24 L46 54 H18 L10 24 Z" fill="#24262e" stroke="#e4c56a" stroke-width="2.2" stroke-linejoin="round"/></svg>`,
  d12: `<svg viewBox="0 0 64 64" aria-hidden="true"><path d="M32 5 L50 14 L58 32 L50 50 L32 59 L14 50 L6 32 L14 14 Z" fill="#24262e" stroke="#e4c56a" stroke-width="2.2" stroke-linejoin="round"/></svg>`,
  d20: `<svg viewBox="0 0 64 64" aria-hidden="true"><path d="M32 5 L54 18 L58 40 L44 57 H20 L6 40 L10 18 Z" fill="#24262e" stroke="#e4c56a" stroke-width="2.2" stroke-linejoin="round"/><path d="M32 5 L32 32 L6 40 M32 32 L58 40 M32 32 L20 57 M32 32 L44 57" fill="none" stroke="#e4c56a" stroke-width="1.2" opacity="0.7"/></svg>`,
  d100: `<svg viewBox="0 0 64 64" aria-hidden="true"><circle cx="32" cy="32" r="22" fill="#24262e" stroke="#e4c56a" stroke-width="2.2"/><text x="32" y="37" text-anchor="middle" font-size="14" font-family="Segoe UI, sans-serif" fill="#f6f4ef">%</text></svg>`,
};

const selector = document.getElementById("selector");
const viewport = document.getElementById("dieViewport");
const formula = document.getElementById("formula");
const resultEl = document.getElementById("result");
const callout = document.getElementById("callout");
const rollBtn = document.getElementById("roll");

let selected = DICE.find((d) => d.id === "d20");
let rolling = false;

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(34, 1, 0.1, 40);
camera.position.set(0.2, 3.35, 5.15);
camera.lookAt(0, 0.25, 0);
const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
renderer.shadowMap.enabled = true;
viewport.appendChild(renderer.domElement);

scene.add(new THREE.AmbientLight(0xffffff, 0.62));
const key = new THREE.DirectionalLight(0xfff4d2, 2.4);
key.position.set(3.2, 6.4, 2.4);
key.castShadow = true;
key.shadow.mapSize.set(1024, 1024);
scene.add(key);
const rim = new THREE.DirectionalLight(0x8ea2ff, 0.55);
rim.position.set(-3.2, 2.4, -2.2);
scene.add(rim);

const TABLE_R = 2.7;
const felt = new THREE.Mesh(
  new THREE.CircleGeometry(TABLE_R, 72),
  new THREE.MeshStandardMaterial({ color: 0x1a4a34, roughness: 0.92, metalness: 0.02 })
);
felt.rotation.x = -Math.PI / 2;
felt.receiveShadow = true;
const rimMesh = new THREE.Mesh(
  new THREE.RingGeometry(TABLE_R - 0.08, TABLE_R + 0.12, 72),
  new THREE.MeshStandardMaterial({ color: 0x6b4a28, roughness: 0.72, metalness: 0.08, side: THREE.DoubleSide })
);
rimMesh.rotation.x = -Math.PI / 2;
rimMesh.position.y = 0.004;
const tableEdge = new THREE.Mesh(
  new THREE.CylinderGeometry(TABLE_R + 0.12, TABLE_R + 0.16, 0.18, 72),
  new THREE.MeshStandardMaterial({ color: 0x4a3018, roughness: 0.8, metalness: 0.05 })
);
tableEdge.position.y = -0.09;
scene.add(tableEdge, felt, rimMesh);

const clock = new THREE.Clock();
let dieRoot = null;
let faceRecords = [];
let dieRadius = 0.62;
let mode = "idle";
let velocity = new THREE.Vector3();
let omega = new THREE.Vector3();
let rollTime = 0;
let settleFrom = new THREE.Quaternion();
let settleTo = new THREE.Quaternion();
let settlePos = new THREE.Vector3();
let settleStart = 0;
const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

function resize() {
  const w = viewport.clientWidth || 320;
  const h = viewport.clientHeight || 250;
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
  renderer.setSize(w, h, false);
}
resize();
new ResizeObserver(resize).observe(viewport);

function outwardTriangles(geometry) {
  const pos = geometry.attributes.position;
  const index = geometry.index;
  const count = index ? index.count : pos.count;
  const tris = [];
  for (let i = 0; i < count; i += 3) {
    const ia = index ? index.getX(i) : i;
    const ib = index ? index.getX(i + 1) : i + 1;
    const ic = index ? index.getX(i + 2) : i + 2;
    const a = new THREE.Vector3().fromBufferAttribute(pos, ia);
    const b = new THREE.Vector3().fromBufferAttribute(pos, ib);
    const c = new THREE.Vector3().fromBufferAttribute(pos, ic);
    const normal = new THREE.Vector3().crossVectors(b.clone().sub(a), c.clone().sub(a));
    if (normal.lengthSq() < 1e-8) continue;
    normal.normalize();
    const centroid = a.clone().add(b).add(c).divideScalar(3);
    if (centroid.dot(normal) < 0) normal.negate();
    tris.push({ normal, centroid });
  }
  return tris;
}

function clusterFaces(tris, align = 0.96) {
  const groups = [];
  for (const tri of tris) {
    let group = groups.find((item) => item.normal.dot(tri.normal) > align);
    if (!group) {
      group = { normal: tri.normal.clone(), points: [] };
      groups.push(group);
    }
    group.points.push(tri.centroid);
  }
  return groups.map((group) => ({
    normal: group.normal.clone().normalize(),
    centroid: group.points.reduce((sum, point) => sum.add(point), new THREE.Vector3()).divideScalar(group.points.length),
  }));
}

function makeD10Geometry() {
  const vertices = [];
  for (let i = 0, angle = 0; i < 10; i += 1, angle += Math.PI * 2 / 10) {
    vertices.push(new THREE.Vector3(Math.cos(angle), Math.sin(angle), 0.105 * (i % 2 ? 1 : -1)));
  }
  vertices.push(new THREE.Vector3(0, 0, -1), new THREE.Vector3(0, 0, 1));
  const faces = [
    [5, 7, 11], [4, 2, 10], [1, 3, 11], [0, 8, 10], [7, 9, 11],
    [8, 6, 10], [9, 1, 11], [2, 0, 10], [3, 5, 11], [6, 4, 10],
    [1, 0, 2], [1, 2, 3], [3, 2, 4], [3, 4, 5], [5, 4, 6],
    [5, 6, 7], [7, 6, 8], [7, 8, 9], [9, 8, 0], [9, 0, 1],
  ];
  const positions = [];
  for (const face of faces) {
    for (const index of face) positions.push(vertices[index].x, vertices[index].y, vertices[index].z);
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  geometry.computeVertexNormals();
  geometry.userData.numberedTriangles = 10;
  return geometry;
}

function planeMeet(n1, n2, n3) {
  const n2n3 = new THREE.Vector3().crossVectors(n2, n3);
  const det = n1.dot(n2n3);
  if (Math.abs(det) < 1e-5) return null;
  return n2n3
    .add(new THREE.Vector3().crossVectors(n3, n1))
    .add(new THREE.Vector3().crossVectors(n1, n2))
    .multiplyScalar(1 / det);
}

function makeD100Geometry() {
  const count = 100;
  const normals = [];
  const golden = Math.PI * (3 - Math.sqrt(5));
  for (let i = 0; i < count; i += 1) {
    const y = 1 - (i / (count - 1)) * 2;
    const ring = Math.sqrt(Math.max(0, 1 - y * y));
    const theta = golden * i;
    normals.push(new THREE.Vector3(Math.cos(theta) * ring, y, Math.sin(theta) * ring).normalize());
  }
  const cosCut = Math.cos(1.15);
  const neighbors = normals.map((normal, i) => {
    const near = [];
    for (let j = 0; j < count; j += 1) {
      if (i !== j && normal.dot(normals[j]) > cosCut) near.push(j);
    }
    return near;
  });
  const faces = Array.from({ length: count }, () => []);
  const seen = new Set();
  for (let i = 0; i < count; i += 1) {
    const near = neighbors[i];
    for (let a = 0; a < near.length; a += 1) {
      for (let b = a + 1; b < near.length; b += 1) {
        const j = near[a];
        const k = near[b];
        if (normals[j].dot(normals[k]) <= cosCut) continue;
        const key = [i, j, k].sort((p, q) => p - q).join(",");
        if (seen.has(key)) continue;
        seen.add(key);
        const vertex = planeMeet(normals[i], normals[j], normals[k]);
        if (!vertex) continue;
        let inside = true;
        for (let m = 0; m < count; m += 1) {
          if (vertex.dot(normals[m]) > 1.004) {
            inside = false;
            break;
          }
        }
        if (!inside) continue;
        faces[i].push(vertex.clone());
        faces[j].push(vertex.clone());
        faces[k].push(vertex.clone());
      }
    }
  }
  const positions = [];
  for (let i = 0; i < count; i += 1) {
    const verts = faces[i];
    if (verts.length < 3) continue;
    const unique = [];
    for (const point of verts) {
      if (!unique.some((kept) => kept.distanceToSquared(point) < 1e-6)) unique.push(point);
    }
    verts.length = 0;
    verts.push(...unique);
    if (verts.length < 3) continue;
    const center = verts.reduce((sum, point) => sum.add(point), new THREE.Vector3()).divideScalar(verts.length);
    const normal = normals[i];
    const helper = Math.abs(normal.y) > 0.9 ? new THREE.Vector3(1, 0, 0) : new THREE.Vector3(0, 1, 0);
    const xAxis = new THREE.Vector3().crossVectors(helper, normal).normalize();
    const yAxis = new THREE.Vector3().crossVectors(normal, xAxis).normalize();
    verts.sort((p, q) => {
      const dp = p.clone().sub(center);
      const dq = q.clone().sub(center);
      return Math.atan2(dp.dot(yAxis), dp.dot(xAxis)) - Math.atan2(dq.dot(yAxis), dq.dot(xAxis));
    });
    for (let t = 1; t < verts.length - 1; t += 1) {
      positions.push(
        verts[0].x, verts[0].y, verts[0].z,
        verts[t].x, verts[t].y, verts[t].z,
        verts[t + 1].x, verts[t + 1].y, verts[t + 1].z
      );
    }
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  geometry.computeVertexNormals();
  return geometry;
}

function geometryFor(id) {
  if (id === "d4") return new THREE.TetrahedronGeometry(1.15);
  if (id === "d6") return new THREE.BoxGeometry(1.55, 1.55, 1.55);
  if (id === "d8") return new THREE.OctahedronGeometry(1.25);
  if (id === "d10") return makeD10Geometry();
  if (id === "d100") return makeD100Geometry();
  if (id === "d12") return new THREE.DodecahedronGeometry(1.15);
  return new THREE.IcosahedronGeometry(1.2);
}

function makeLabel(text, size) {
  const canvas = document.createElement("canvas");
  canvas.width = 256;
  canvas.height = 256;
  const texture = new THREE.CanvasTexture(canvas);
  const material = new THREE.MeshBasicMaterial({
    map: texture,
    transparent: true,
    depthWrite: false,
    polygonOffset: true,
    polygonOffsetFactor: -2,
  });
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(size, size), material);
  mesh.userData.canvas = canvas;
  mesh.userData.texture = texture;
  setLabel(mesh, text);
  return mesh;
}

function setLabel(mesh, text) {
  const canvas = mesh.userData.canvas;
  const ctx = canvas.getContext("2d");
  ctx.clearRect(0, 0, 256, 256);
  ctx.fillStyle = "rgba(8, 7, 6, 0.94)";
  ctx.beginPath();
  ctx.arc(128, 128, 112, 0, Math.PI * 2);
  ctx.fill();
  ctx.lineWidth = 10;
  ctx.strokeStyle = "#e4c56a";
  ctx.stroke();
  ctx.font = `700 ${String(text).length > 2 ? 104 : 148}px Segoe UI, sans-serif`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.lineWidth = 14;
  ctx.strokeStyle = "#1a1206";
  ctx.strokeText(String(text), 128, 136);
  ctx.fillStyle = "#ffe7a3";
  ctx.fillText(String(text), 128, 136);
  mesh.userData.texture.needsUpdate = true;
}

function showDie(id) {
  if (dieRoot) {
    scene.remove(dieRoot);
    dieRoot.traverse((obj) => {
      if (obj.geometry) obj.geometry.dispose();
      if (obj.material) {
        if (obj.material.map) obj.material.map.dispose();
        obj.material.dispose();
      }
    });
  }
  const geometry = geometryFor(id);
  geometry.computeBoundingBox();
  geometry.center();
  const body = new THREE.Mesh(
    geometry,
    new THREE.MeshStandardMaterial({ color: 0x3a3124, metalness: 0.35, roughness: 0.42, flatShading: true })
  );
  body.castShadow = true;
  body.receiveShadow = true;
  const edges = new THREE.LineSegments(
    new THREE.EdgesGeometry(geometry, 1),
    new THREE.LineBasicMaterial({ color: 0xe4c56a })
  );
  const group = new THREE.Group();
  group.add(body);
  group.add(edges);

  const faces = geometry.userData.numberedTriangles
    ? outwardTriangles(geometry).slice(0, geometry.userData.numberedTriangles)
    : clusterFaces(outwardTriangles(geometry), id === "d100" ? 0.992 : 0.96);
  const values = faces.map((_, index) => index + 1);
  const labelSize = id === "d100" ? 0.2 : id === "d10" ? 0.4 : faces.length > 12 ? 0.42 : 0.62;
  faceRecords = faces.slice(0, values.length).map((face, index) => {
    const label = makeLabel(values[index], labelSize);
    const zAxis = new THREE.Vector3(0, 0, 1);
    label.position.copy(face.centroid).addScaledVector(face.normal, 0.045);
    label.quaternion.setFromUnitVectors(zAxis, face.normal);
    group.add(label);
    return { value: values[index], normal: face.normal.clone(), label };
  });

  const box = new THREE.Box3().setFromObject(group);
  const radius = box.getBoundingSphere(new THREE.Sphere()).radius || 1;
  group.scale.setScalar(0.62 / radius);
  const fitted = new THREE.Box3().setFromObject(group);
  const center = fitted.getCenter(new THREE.Vector3());
  group.position.sub(center);
  dieRadius = fitted.getBoundingSphere(new THREE.Sphere()).radius || 0.62;
  group.position.set(0, dieRadius, 0);
  dieRoot = group;
  scene.add(group);
  mode = "idle";
  velocity.set(0, 0, 0);
  omega.set(0, 0, 0);
}

function faceQuaternion(record) {
  const up = new THREE.Quaternion().setFromUnitVectors(record.normal.clone().normalize(), new THREE.Vector3(0, 1, 0));
  const yaw = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), Math.random() * Math.PI * 2);
  return yaw.multiply(up);
}

function stepRoll(dt) {
  rollTime += dt;
  velocity.y -= 16 * dt;
  dieRoot.position.addScaledVector(velocity, dt);
  const spin = omega.length();
  if (spin > 1e-4) dieRoot.rotateOnWorldAxis(omega.clone().multiplyScalar(1 / spin), spin * dt);
  if (dieRoot.position.y < dieRadius) {
    dieRoot.position.y = dieRadius;
    if (velocity.y < 0) velocity.y = -velocity.y * 0.32;
    const drag = Math.max(0, 1 - 3.4 * dt);
    velocity.x *= drag;
    velocity.z *= drag;
    omega.multiplyScalar(Math.max(0, 1 - 1.8 * dt));
    omega.x += velocity.z * 5 * dt;
    omega.z -= velocity.x * 5 * dt;
  }
  const flat = Math.hypot(dieRoot.position.x, dieRoot.position.z);
  if (flat > TABLE_R - dieRadius * 0.35) {
    const nx = dieRoot.position.x / flat;
    const nz = dieRoot.position.z / flat;
    const limit = TABLE_R - dieRadius * 0.35;
    dieRoot.position.x = nx * limit;
    dieRoot.position.z = nz * limit;
    const outward = velocity.x * nx + velocity.z * nz;
    if (outward > 0) {
      velocity.x -= 1.4 * outward * nx;
      velocity.z -= 1.4 * outward * nz;
      omega.y += (Math.random() - 0.5) * 2;
    }
  }
  const energy = velocity.length() + omega.length() * 0.25;
  if (mode === "roll" && ((dieRoot.position.y <= dieRadius + 0.02 && energy < 0.72 && rollTime > 0.85) || rollTime > 3.6)) {
    landOn(pendingValue);
  }
}

function animate() {
  requestAnimationFrame(animate);
  const dt = Math.min(clock.getDelta(), 0.05);
  if (dieRoot && mode === "roll" && !reduceMotion) stepRoll(dt);
  else if (dieRoot && mode === "settle") {
    const t = Math.min(1, (performance.now() - settleStart) / 460);
    const eased = 1 - Math.pow(1 - t, 3);
    dieRoot.quaternion.slerpQuaternions(settleFrom, settleTo, eased);
    dieRoot.position.lerpVectors(settlePos, new THREE.Vector3(settlePos.x, dieRadius, settlePos.z), eased);
    if (t >= 1) {
      dieRoot.position.y = dieRadius;
      mode = "hold";
    }
  }
  renderer.render(scene, camera);
}
animate();

function renderSelector() {
  selector.replaceChildren();
  for (const die of DICE) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "die-btn";
    button.setAttribute("role", "radio");
    button.setAttribute("aria-checked", die.id === selected.id ? "true" : "false");
    button.innerHTML = `${glyphs[die.id]}<span>${die.id}</span>`;
    button.addEventListener("click", () => choose(die.id));
    selector.appendChild(button);
  }
}

function choose(id) {
  if (rolling) return;
  selected = DICE.find((d) => d.id === id);
  formula.textContent = `1${selected.id}`;
  showDie(id);
  renderSelector();
}

function setCallout(value, sides) {
  callout.className = "callout";
  if (sides === 20 && value === 20) {
    callout.textContent = "Natural 20";
    callout.classList.add("crit");
  } else if (sides === 20 && value === 1) {
    callout.textContent = "Natural 1";
    callout.classList.add("fail");
  } else if (value === sides) {
    callout.textContent = "Maximum";
  } else if (value === 1) {
    callout.textContent = "Minimum";
  } else {
    callout.textContent = "";
  }
}

let pendingValue = 1;

function landOn(value) {
  const record = faceRecords.find((face) => face.value === value) || faceRecords[0];
  settleTo = faceQuaternion(record);
  dieRoot.position.y = Math.max(dieRoot.position.y, dieRadius);
  if (reduceMotion) {
    dieRoot.quaternion.copy(settleTo);
    dieRoot.position.y = dieRadius;
    mode = "hold";
    return;
  }
  settleFrom = dieRoot.quaternion.clone();
  settlePos = dieRoot.position.clone();
  settleStart = performance.now();
  mode = "settle";
}

function roll() {
  if (rolling) return;
  rolling = true;
  rollBtn.disabled = true;
  const sides = selected.sides;
  const finalValue = 1 + Math.floor(Math.random() * sides);
  pendingValue = finalValue;
  resultEl.classList.add("rolling");
  callout.textContent = "";
  callout.className = "callout";
  if (reduceMotion) {
    landOn(finalValue);
    resultEl.textContent = finalValue;
    resultEl.classList.remove("rolling");
    setCallout(finalValue, sides);
    rolling = false;
    rollBtn.disabled = false;
    return;
  }
  dieRoot.position.set((Math.random() - 0.5) * 0.8, dieRadius + 1.7, (Math.random() - 0.5) * 0.6);
  velocity.set((Math.random() - 0.5) * 3.2, 1.1, (Math.random() - 0.5) * 3.2);
  omega.set(Math.random() * 14 - 7, Math.random() * 14 - 7, Math.random() * 14 - 7);
  rollTime = 0;
  mode = "roll";
  function frame() {
    if (mode === "roll") {
      resultEl.textContent = 1 + Math.floor(Math.random() * sides);
      requestAnimationFrame(frame);
      return;
    }
    resultEl.textContent = finalValue;
    resultEl.classList.remove("rolling");
    setCallout(finalValue, sides);
    rolling = false;
    rollBtn.disabled = false;
  }
  requestAnimationFrame(frame);
}

rollBtn.addEventListener("click", roll);

document.addEventListener("keydown", (event) => {
  if (event.repeat) return;
  if (event.code === "Space" || event.code === "Enter") {
    event.preventDefault();
    roll();
    return;
  }
  const index = Number(event.key) - 1;
  if (index >= 0 && index < DICE.length && event.key !== " ") choose(DICE[index].id);
});

choose("d20");
resultEl.textContent = "—";
