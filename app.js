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
const camera = new THREE.PerspectiveCamera(32, 1, 0.1, 30);
camera.position.set(0, 0.15, 6.2);
camera.lookAt(0, 0, 0);
const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
viewport.appendChild(renderer.domElement);

scene.add(new THREE.AmbientLight(0xffffff, 0.55));
const key = new THREE.DirectionalLight(0xfff4d2, 2.2);
key.position.set(2.4, 4.2, 3.2);
scene.add(key);
const rim = new THREE.DirectionalLight(0x8ea2ff, 0.7);
rim.position.set(-3, 1.2, -2);
scene.add(rim);

const clock = new THREE.Clock();
let dieRoot = null;
let faceRecords = [];
let mode = "idle";
let spinAxis = new THREE.Vector3(0.4, 1, 0.2).normalize();
let spinSpeed = 0.6;
let settleFrom = new THREE.Quaternion();
let settleTo = new THREE.Quaternion();
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

function clusterFaces(tris) {
  const groups = [];
  for (const tri of tris) {
    let group = groups.find((item) => item.normal.dot(tri.normal) > 0.96);
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

function geometryFor(id) {
  if (id === "d4") return new THREE.TetrahedronGeometry(1.15);
  if (id === "d6") return new THREE.BoxGeometry(1.55, 1.55, 1.55);
  if (id === "d8") return new THREE.OctahedronGeometry(1.25);
  if (id === "d10" || id === "d100") return makeD10Geometry();
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
  const edges = new THREE.LineSegments(
    new THREE.EdgesGeometry(geometry, 1),
    new THREE.LineBasicMaterial({ color: 0xe4c56a })
  );
  const group = new THREE.Group();
  group.add(body);
  group.add(edges);

  const faces = geometry.userData.numberedTriangles
    ? outwardTriangles(geometry).slice(0, geometry.userData.numberedTriangles)
    : clusterFaces(outwardTriangles(geometry));
  const values = id === "d100"
    ? [10, 20, 30, 40, 50, 60, 70, 80, 90, 100]
    : faces.map((_, index) => index + 1);
  const labelSize = id === "d10" || id === "d100" ? 0.4 : faces.length > 12 ? 0.42 : 0.62;
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
  const dist = camera.position.length();
  const visibleHeight = 2 * Math.tan((camera.fov * Math.PI / 180) / 2) * dist;
  group.scale.setScalar((visibleHeight * 0.72) / (radius * 2));
  const fitted = new THREE.Box3().setFromObject(group);
  group.position.sub(fitted.getCenter(new THREE.Vector3()));
  dieRoot = group;
  scene.add(group);
  mode = "idle";
  spinSpeed = reduceMotion ? 0 : 0.45;
}

function faceQuaternion(record) {
  const towardCamera = camera.position.clone().normalize();
  return new THREE.Quaternion().setFromUnitVectors(record.normal.clone().normalize(), towardCamera);
}

function animate() {
  requestAnimationFrame(animate);
  const dt = Math.min(clock.getDelta(), 0.05);
  if (dieRoot && mode === "spin") {
    dieRoot.rotateOnAxis(spinAxis, spinSpeed * dt);
    spinSpeed = Math.max(2.2, spinSpeed * Math.pow(0.22, dt));
  } else if (dieRoot && mode === "settle") {
    const t = Math.min(1, (performance.now() - settleStart) / 520);
    dieRoot.quaternion.slerpQuaternions(settleFrom, settleTo, 1 - Math.pow(1 - t, 3));
    if (t >= 1) mode = "hold";
  } else if (dieRoot && mode === "idle" && !reduceMotion) {
    dieRoot.rotateY(spinSpeed * dt);
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

function landOn(value) {
  let record = faceRecords.find((face) => face.value === value) || faceRecords[0];
  if (selected.id === "d100") {
    record = faceRecords[Math.floor(Math.random() * faceRecords.length)];
    setLabel(record.label, value);
  }
  settleTo = faceQuaternion(record);
  if (reduceMotion) {
    dieRoot.quaternion.copy(settleTo);
    mode = "hold";
    return;
  }
  settleFrom = dieRoot.quaternion.clone();
  settleStart = performance.now();
  mode = "settle";
}

function roll() {
  if (rolling) return;
  rolling = true;
  rollBtn.disabled = true;
  const sides = selected.sides;
  const finalValue = 1 + Math.floor(Math.random() * sides);
  const duration = reduceMotion ? 0 : 900;
  resultEl.classList.add("rolling");
  callout.textContent = "";
  callout.className = "callout";
  if (!reduceMotion) {
    spinAxis = new THREE.Vector3(Math.random() * 2 - 1, Math.random() * 2 - 1, Math.random() * 2 - 1).normalize();
    spinSpeed = 14;
    mode = "spin";
  }
  const started = performance.now();
  function frame(now) {
    if (now - started < duration) {
      resultEl.textContent = 1 + Math.floor(Math.random() * sides);
      requestAnimationFrame(frame);
      return;
    }
    resultEl.textContent = finalValue;
    resultEl.classList.remove("rolling");
    landOn(finalValue);
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
