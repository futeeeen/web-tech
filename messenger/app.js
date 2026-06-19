import * as THREE from "./vendor/three.module.min.js";

const canvas = document.querySelector("#world");
const enterButton = document.querySelector("#enter-world");
const loading = document.querySelector("#loading");
const signalList = document.querySelector("#signal-list");
const signalCount = document.querySelector("#signal-count");
const messageChannel = document.querySelector("#message-channel");
const messageTime = document.querySelector("#message-time");
const messageCopy = document.querySelector("#message-copy");
const messageAvatar = document.querySelector("#message-avatar");
const messageName = document.querySelector("#message-name");
const messageLocation = document.querySelector("#message-location");
const composer = document.querySelector("#composer");
const messageInput = document.querySelector("#message-input");
const soundToggle = document.querySelector("#sound-toggle");
const resetView = document.querySelector("#reset-view");
const toast = document.querySelector("#toast");
const fpsOutput = document.querySelector("#fps");

const colors = {
  sky: 0x78c4bf,
  ink: 0x152e38,
  paper: 0xf3f1df,
  yellow: 0xf2c84b,
  coral: 0xe67f68,
  mint: 0xb9dfba,
  green: 0x5d9b72,
  stone: 0xa9afa5
};

const messages = [
  { name: "ASTER", channel: "FOREST NODE", location: "NORTH CANOPY", time: "NOW", color: "#5d9b72", text: "有些訊息不需要目的地，只需要一條願意繞行的軌道。" },
  { name: "MICA", channel: "CITY RELAY", location: "WEST BLOCK", time: "02M", color: "#e67f68", text: "城市熄燈後，窗戶仍然替每個晚歸的人保留座標。" },
  { name: "NOA", channel: "TIDAL PORT", location: "SOUTH SHORE", time: "08M", color: "#f2c84b", text: "潮汐把昨天帶走，也把沒說完的句子送了回來。" },
  { name: "IVO", channel: "ORBITAL YARD", location: "RING 07", time: "13M", color: "#8b79b9", text: "我在第七軌道修好一盞燈，現在它正朝你的方向閃爍。" },
  { name: "SENA", channel: "QUIET FACTORY", location: "EAST STACK", time: "21M", color: "#88939b", text: "機器停下來的那一秒，整座工廠像是終於吸了一口氣。" },
  { name: "RUE", channel: "CLOUD ARRAY", location: "UPPER AIR", time: "34M", color: "#f3f1df", text: "雲沒有保存功能，但它記得如何把影子交給下一座山。" }
];

const renderer = new THREE.WebGLRenderer({ canvas, antialias: false, powerPreference: "high-performance" });
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 0.8));
renderer.setSize(window.innerWidth, window.innerHeight, false);
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.shadowMap.enabled = false;

const scene = new THREE.Scene();
scene.background = new THREE.Color(colors.sky);
scene.fog = new THREE.Fog(colors.sky, 10, 22);

const camera = new THREE.PerspectiveCamera(42, window.innerWidth / window.innerHeight, 0.1, 100);
camera.position.set(0, 0.5, 9.2);

scene.add(new THREE.HemisphereLight(colors.paper, colors.ink, 2.4));
const keyLight = new THREE.DirectionalLight(0xffffff, 3.2);
keyLight.position.set(5, 7, 8);
scene.add(keyLight);

const rimLight = new THREE.DirectionalLight(colors.coral, 2.1);
rimLight.position.set(-6, 2, -4);
scene.add(rimLight);

const world = new THREE.Group();
world.rotation.set(-0.18, -0.45, 0.03);
scene.add(world);

let randomSeed = 48271;
function random() {
  randomSeed = (randomSeed * 16807) % 2147483647;
  return (randomSeed - 1) / 2147483646;
}

function pointOnSphere(latitude, longitude, radius = 2.25) {
  const phi = THREE.MathUtils.degToRad(90 - latitude);
  const theta = THREE.MathUtils.degToRad(longitude);
  return new THREE.Vector3(
    radius * Math.sin(phi) * Math.cos(theta),
    radius * Math.cos(phi),
    radius * Math.sin(phi) * Math.sin(theta)
  );
}

function alignToSurface(object, position) {
  object.position.copy(position);
  object.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), position.clone().normalize());
}

function createPlanet() {
  const geometry = new THREE.IcosahedronGeometry(2.18, 2).toNonIndexed();
  const positions = geometry.attributes.position;
  const palette = [
    new THREE.Color(0x7fb69d),
    new THREE.Color(0x93c6aa),
    new THREE.Color(0xd6bf78),
    new THREE.Color(0xcf8b70),
    new THREE.Color(0xa6b59c)
  ];
  const vertexColors = [];

  for (let i = 0; i < positions.count; i += 3) {
    const y = positions.getY(i);
    const index = Math.abs(Math.floor((y * 3 + random() * palette.length))) % palette.length;
    const color = palette[index];
    for (let j = 0; j < 3; j++) vertexColors.push(color.r, color.g, color.b);
  }

  geometry.setAttribute("color", new THREE.Float32BufferAttribute(vertexColors, 3));
  const material = new THREE.MeshLambertMaterial({ vertexColors: true, flatShading: true });
  const planet = new THREE.Mesh(geometry, material);
  planet.castShadow = true;
  planet.receiveShadow = true;
  world.add(planet);

  const atmosphere = new THREE.Mesh(
    new THREE.IcosahedronGeometry(2.28, 2),
    new THREE.MeshBasicMaterial({ color: colors.paper, transparent: true, opacity: 0.09, side: THREE.BackSide })
  );
  world.add(atmosphere);

  const orbit = new THREE.Mesh(
    new THREE.TorusGeometry(3.05, 0.012, 8, 180),
    new THREE.MeshBasicMaterial({ color: colors.paper, transparent: true, opacity: 0.5 })
  );
  orbit.rotation.set(1.22, 0.3, -0.2);
  world.add(orbit);
}

const trunkMaterial = new THREE.MeshLambertMaterial({ color: 0x704f45, flatShading: true });
const treeMaterials = [
  new THREE.MeshLambertMaterial({ color: colors.green, flatShading: true }),
  new THREE.MeshLambertMaterial({ color: colors.mint, flatShading: true })
];
const stoneMaterial = new THREE.MeshLambertMaterial({ color: colors.stone, flatShading: true });
const buildingMaterials = [colors.paper, colors.yellow, colors.coral, 0x8799aa]
  .map((color) => new THREE.MeshLambertMaterial({ color, flatShading: true }));
const cloudMaterial = new THREE.MeshLambertMaterial({ color: colors.paper, transparent: true, opacity: 0.72, flatShading: true });

function createTree(latitude, longitude, scale = 1) {
  const tree = new THREE.Group();
  const trunk = new THREE.Mesh(
    new THREE.CylinderGeometry(0.035, 0.05, 0.2, 5),
    trunkMaterial
  );
  trunk.position.y = 0.1;
  tree.add(trunk);
  const crown = new THREE.Mesh(
    new THREE.ConeGeometry(0.14 * scale, 0.36 * scale, 6),
    treeMaterials[random() > 0.35 ? 0 : 1]
  );
  crown.position.y = 0.36 * scale;
  crown.castShadow = true;
  tree.add(crown);
  alignToSurface(tree, pointOnSphere(latitude, longitude, 2.18));
  world.add(tree);
}

function createBuilding(latitude, longitude, scale = 1, material = buildingMaterials[0]) {
  const building = new THREE.Group();
  const base = new THREE.Mesh(
    new THREE.CylinderGeometry(0.12 * scale, 0.15 * scale, 0.08, 6),
    stoneMaterial
  );
  base.position.y = 0.04;
  building.add(base);
  const tower = new THREE.Mesh(
    new THREE.BoxGeometry(0.2 * scale, (0.25 + random() * 0.35) * scale, 0.2 * scale),
    material
  );
  tower.position.y = 0.22 * scale;
  tower.rotation.y = random() * Math.PI;
  tower.castShadow = true;
  building.add(tower);
  alignToSurface(building, pointOnSphere(latitude, longitude, 2.18));
  world.add(building);
}

createPlanet();

for (let i = 0; i < 14; i++) {
  createTree(-65 + random() * 130, random() * 360, 0.75 + random() * 0.75);
}

for (let i = 0; i < 8; i++) {
  createBuilding(-58 + random() * 116, random() * 360, 0.75 + random() * 1.1, buildingMaterials[i % buildingMaterials.length]);
}

const beaconGroup = new THREE.Group();
world.add(beaconGroup);
const beaconHits = [];
const beaconPositions = [
  [40, -35], [8, 20], [-28, -5], [18, 130], [-12, 195], [52, 230]
];

messages.forEach((message, index) => {
  const beacon = new THREE.Group();
  const color = new THREE.Color(message.color);
  const mast = new THREE.Mesh(
    new THREE.CylinderGeometry(0.025, 0.045, 0.34, 6),
    new THREE.MeshLambertMaterial({ color: colors.ink, flatShading: true })
  );
  mast.position.y = 0.17;
  beacon.add(mast);
  const light = new THREE.Mesh(
    new THREE.SphereGeometry(0.095, 10, 8),
    new THREE.MeshLambertMaterial({ color, emissive: color, emissiveIntensity: 1.8 })
  );
  light.position.y = 0.42;
  light.userData.signalIndex = index;
  beacon.add(light);
  beaconHits.push(light);
  const ring = new THREE.Mesh(
    new THREE.TorusGeometry(0.19, 0.015, 6, 30),
    new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.78 })
  );
  ring.position.y = 0.4;
  ring.rotation.x = Math.PI / 2;
  beacon.add(ring);
  beacon.userData.ring = ring;
  beacon.userData.phase = index * 0.9;
  alignToSurface(beacon, pointOnSphere(beaconPositions[index][0], beaconPositions[index][1], 2.2));
  beaconGroup.add(beacon);
});

const cloudGroup = new THREE.Group();
world.add(cloudGroup);
for (let i = 0; i < 5; i++) {
  const cloud = new THREE.Group();
  for (let j = 0; j < 3; j++) {
    const puff = new THREE.Mesh(
      new THREE.DodecahedronGeometry(0.14 + random() * 0.09, 0),
      cloudMaterial
    );
    puff.position.set((j - 1) * 0.13, random() * 0.08, random() * 0.08);
    cloud.add(puff);
  }
  alignToSurface(cloud, pointOnSphere(-55 + random() * 110, random() * 360, 2.65 + random() * 0.2));
  cloud.userData.speed = 0.00035 + random() * 0.00025;
  cloudGroup.add(cloud);
}

const capsuleOrbits = new THREE.Group();
world.add(capsuleOrbits);

function addCapsule(index, colorValue = colors.yellow) {
  const pivot = new THREE.Group();
  pivot.rotation.set(index * 0.55, index * 0.9, index * 0.37);
  const capsule = new THREE.Mesh(
    new THREE.CapsuleGeometry(0.07, 0.22, 4, 8),
    new THREE.MeshLambertMaterial({ color: colorValue, emissive: colorValue, emissiveIntensity: 0.2, flatShading: true })
  );
  capsule.position.set(3.05 + (index % 3) * 0.18, 0, 0);
  capsule.rotation.z = Math.PI / 2;
  capsule.castShadow = true;
  pivot.add(capsule);
  pivot.userData.speed = 0.0012 + (index % 4) * 0.00018;
  capsuleOrbits.add(pivot);
}

messages.slice(0, 4).forEach((message, index) => addCapsule(index, new THREE.Color(message.color)));

const starGeometry = new THREE.BufferGeometry();
const starPositions = [];
for (let i = 0; i < 180; i++) {
  const radius = 8 + random() * 12;
  const theta = random() * Math.PI * 2;
  const phi = Math.acos(2 * random() - 1);
  starPositions.push(radius * Math.sin(phi) * Math.cos(theta), radius * Math.cos(phi), radius * Math.sin(phi) * Math.sin(theta));
}
starGeometry.setAttribute("position", new THREE.Float32BufferAttribute(starPositions, 3));
const stars = new THREE.Points(
  starGeometry,
  new THREE.PointsMaterial({ color: colors.paper, size: 0.045, transparent: true, opacity: 0.72, sizeAttenuation: true })
);
scene.add(stars);

function renderSignalList() {
  signalList.replaceChildren();
  messages.forEach((message, index) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "signal-item";
    button.dataset.index = String(index);
    button.style.setProperty("--signal-color", message.color);
    button.innerHTML = `<span class="signal-dot"></span><b>${message.channel}</b><small>${message.time}</small>`;
    button.addEventListener("click", () => selectSignal(index));
    signalList.append(button);
  });
  signalCount.textContent = String(messages.length).padStart(2, "0");
}

function selectSignal(index) {
  const message = messages[index];
  if (!message) return;
  messageChannel.textContent = message.channel;
  messageTime.textContent = message.time;
  messageCopy.textContent = message.text;
  messageAvatar.textContent = message.name.charAt(0);
  messageAvatar.style.background = message.color;
  messageName.textContent = message.name;
  messageLocation.textContent = message.location;
  document.querySelectorAll(".signal-item").forEach((item) => item.classList.toggle("is-active", Number(item.dataset.index) === index));
  worldTarget.x = -0.12 + (index % 3) * 0.1;
  worldTarget.y = -0.55 + Math.floor(index / 3) * 0.18;
  pulseAudio(260 + index * 48, 0.08);
}

const raycaster = new THREE.Raycaster();
const pointer = new THREE.Vector2();
const drag = { active: false, moved: false, x: 0, y: 0, vx: 0, vy: 0 };
const worldTarget = { x: world.rotation.x, y: world.rotation.y };
let cameraTargetZ = 9.2;
let entered = false;

canvas.addEventListener("pointerdown", (event) => {
  drag.active = true;
  drag.moved = false;
  drag.x = event.clientX;
  drag.y = event.clientY;
  drag.vx = 0;
  drag.vy = 0;
  canvas.setPointerCapture(event.pointerId);
});

canvas.addEventListener("pointermove", (event) => {
  if (!drag.active) return;
  const dx = event.clientX - drag.x;
  const dy = event.clientY - drag.y;
  if (Math.abs(dx) + Math.abs(dy) > 2) drag.moved = true;
  worldTarget.y += dx * 0.006;
  worldTarget.x = THREE.MathUtils.clamp(worldTarget.x + dy * 0.004, -1.1, 1.1);
  drag.vx = dx * 0.006;
  drag.vy = dy * 0.004;
  drag.x = event.clientX;
  drag.y = event.clientY;
});

canvas.addEventListener("pointerup", (event) => {
  drag.active = false;
  if (canvas.hasPointerCapture(event.pointerId)) canvas.releasePointerCapture(event.pointerId);
  if (!drag.moved && entered) {
    pointer.x = (event.clientX / window.innerWidth) * 2 - 1;
    pointer.y = -(event.clientY / window.innerHeight) * 2 + 1;
    raycaster.setFromCamera(pointer, camera);
    const hit = raycaster.intersectObjects(beaconHits, false)[0];
    if (hit) selectSignal(hit.object.userData.signalIndex);
  }
});

canvas.addEventListener("wheel", (event) => {
  cameraTargetZ = THREE.MathUtils.clamp(cameraTargetZ + event.deltaY * 0.004, 5.1, 10.5);
}, { passive: true });

let audioContext;
let soundEnabled = true;

renderSignalList();
selectSignal(0);

function ensureAudio() {
  if (!audioContext) audioContext = new AudioContext();
  if (audioContext.state === "suspended") audioContext.resume();
}

function pulseAudio(frequency = 320, duration = 0.12) {
  if (!soundEnabled || !entered) return;
  ensureAudio();
  const oscillator = audioContext.createOscillator();
  const gain = audioContext.createGain();
  oscillator.type = "sine";
  oscillator.frequency.setValueAtTime(frequency, audioContext.currentTime);
  oscillator.frequency.exponentialRampToValueAtTime(frequency * 1.55, audioContext.currentTime + duration);
  gain.gain.setValueAtTime(0.0001, audioContext.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.08, audioContext.currentTime + 0.015);
  gain.gain.exponentialRampToValueAtTime(0.0001, audioContext.currentTime + duration);
  oscillator.connect(gain).connect(audioContext.destination);
  oscillator.start();
  oscillator.stop(audioContext.currentTime + duration + 0.02);
}

enterButton.addEventListener("click", () => {
  entered = true;
  document.body.classList.add("is-entered");
  cameraTargetZ = 7.1;
  ensureAudio();
  pulseAudio(220, 0.22);
  window.setTimeout(() => document.querySelector("#intro").hidden = true, 750);
});

soundToggle.addEventListener("click", () => {
  soundEnabled = !soundEnabled;
  soundToggle.classList.toggle("is-off", !soundEnabled);
  soundToggle.textContent = soundEnabled ? "♪" : "×";
  if (soundEnabled) pulseAudio(360, 0.08);
});

resetView.addEventListener("click", () => {
  worldTarget.x = -0.18;
  worldTarget.y = -0.45;
  cameraTargetZ = 7.1;
  pulseAudio(290, 0.1);
});

let toastTimer;
function showToast(text) {
  toast.textContent = text;
  toast.classList.add("is-visible");
  window.clearTimeout(toastTimer);
  toastTimer = window.setTimeout(() => toast.classList.remove("is-visible"), 1800);
}

composer.addEventListener("submit", (event) => {
  event.preventDefault();
  const text = messageInput.value.trim();
  if (!text) return;
  const message = {
    name: "YOU",
    channel: `USER SIGNAL ${String(messages.length - 5).padStart(2, "0")}`,
    location: "CURRENT ORBIT",
    time: "NOW",
    color: "#f2c84b",
    text
  };
  messages.unshift(message);
  addCapsule(messages.length + 2, colors.yellow);
  renderSignalList();
  selectSignal(0);
  messageInput.value = "";
  pulseAudio(180, 0.28);
  showToast("TRANSMISSION ADDED TO ORBIT");
});

let previousTime = performance.now();
let smoothFps = 60;
let frameCounter = 0;
const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

function animate(now) {
  const delta = Math.min(40, now - previousTime);
  previousTime = now;
  smoothFps += ((1000 / Math.max(1, delta)) - smoothFps) * 0.06;
  if (frameCounter++ % 12 === 0) fpsOutput.textContent = String(Math.round(smoothFps));

  if (!drag.active) {
    worldTarget.y += drag.vx;
    worldTarget.x += drag.vy;
    drag.vx *= 0.92;
    drag.vy *= 0.92;
    if (Math.abs(drag.vx) < 0.0002) worldTarget.y += reduceMotion ? 0 : 0.00045;
  }

  world.rotation.x += (worldTarget.x - world.rotation.x) * 0.08;
  world.rotation.y += (worldTarget.y - world.rotation.y) * 0.08;
  camera.position.z += (cameraTargetZ - camera.position.z) * 0.06;

  cloudGroup.children.forEach((cloud) => {
    cloud.rotation.y += cloud.userData.speed * delta;
  });

  capsuleOrbits.children.forEach((pivot) => {
    pivot.rotation.z += pivot.userData.speed * delta;
  });

  beaconGroup.children.forEach((beacon) => {
    const pulse = 1 + Math.sin(now * 0.003 + beacon.userData.phase) * 0.16;
    beacon.userData.ring.scale.setScalar(pulse);
    beacon.userData.ring.material.opacity = 0.5 + pulse * 0.18;
  });

  stars.rotation.y = now * 0.000012;
  camera.lookAt(0, 0, 0);
  renderer.render(scene, camera);
  requestAnimationFrame(animate);
}

window.addEventListener("resize", () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 0.8));
  renderer.setSize(window.innerWidth, window.innerHeight, false);
});

loading.classList.add("is-complete");
renderer.render(scene, camera);
requestAnimationFrame(animate);
