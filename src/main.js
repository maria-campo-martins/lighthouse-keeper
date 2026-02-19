import * as THREE from "three";
import { createShipSystem } from "./ships.js";
import { createRockSystem } from "./rocks.js";

// -----------------------------------------------------------------------------
// Constants: night scene and day/night transition
// -----------------------------------------------------------------------------
const CONFIG = {
  // Lighthouse keeper camera (eye space: view from the tower)
  cameraHeight: 4,
  cameraFov: 60,
  cameraNear: 0.1,
  cameraFar: 2000,
  cameraPosY: 80,
  cameraPosZ: 120,
  cameraLookZ: 300,

  // Ocean plane (world space: horizon in front of the keeper)
  oceanSize: 1200,
  oceanSegments: 32,

  // Night atmosphere — visible dark blues so horizon is clear from the start
  ambientIntensity: 0.15,
  ambientColor: 0x1a1a2e,
  skyColorNight: 0x0a1428,
  oceanColorNight: 0x030a17,
  fogNear: 400,
  fogFar: 1200,
  fogColorNight: 0x080c18,

  // Dawn
  skyColorDawn: 0x87ceeb,
  oceanColorDawn: 0x0d4d87,
  fogColorDawn: 0x87ceeb,

  // Lighthouse beam
  beamLength: 800,
  beamRadius: 50,
  beamSegments: 24,
  beamColor: 0xffffaa,
  beamOpacity: 0.35,
  beamRotationSpeed: 0.02,
  lampOffsetX: -0.001,
  lampOffsetY: -0.1,
  lampOffsetZ: 0,

  // One full loop duration (seconds) — ships + sunrise synced to this
  cycleDuration: 120,
  cycleShipCount: 3,
  cycleSpawnStart: 0.0,
  cycleSpawnEnd: 30.0,

  // Ship path (used to compute deterministic speed)
  shipSpawnZ: 550,
  shipArriveZ: 30,
  shipLaneX: [-80, 0, 80],
  shipY: 0.6,
};

// -----------------------------------------------------------------------------
// Scene, camera, renderer
// -----------------------------------------------------------------------------
const scene = new THREE.Scene();
const clock = new THREE.Clock();

const camera = new THREE.PerspectiveCamera(
  CONFIG.cameraFov,
  window.innerWidth / window.innerHeight,
  CONFIG.cameraNear,
  CONFIG.cameraFar
);
camera.position.set(0, CONFIG.cameraPosY, CONFIG.cameraPosZ);
camera.lookAt(0, 0, CONFIG.cameraLookZ);

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
document.body.appendChild(renderer.domElement);

// -----------------------------------------------------------------------------
// Reusable color instances for lerp (avoid allocations in loop)
// -----------------------------------------------------------------------------
const _skyColor = new THREE.Color();
const _oceanColor = new THREE.Color();
const _fogColor = new THREE.Color();

// -----------------------------------------------------------------------------
// Scene objects updated during transition
// -----------------------------------------------------------------------------
let oceanMaterial;
let fogRef;
let beamGroup;
let beamMesh;
let beamLight;

// -----------------------------------------------------------------------------
// Night environment: sky, ocean, fog, lighting
// -----------------------------------------------------------------------------
function setupScene() {
  scene.background = new THREE.Color(CONFIG.skyColorNight);

  fogRef = new THREE.Fog(CONFIG.fogColorNight, CONFIG.fogNear, CONFIG.fogFar);
  scene.fog = fogRef;

  const oceanGeometry = new THREE.PlaneGeometry(
    CONFIG.oceanSize,
    CONFIG.oceanSize,
    CONFIG.oceanSegments,
    CONFIG.oceanSegments
  );
  oceanMaterial = new THREE.MeshBasicMaterial({ color: CONFIG.oceanColorNight });
  const ocean = new THREE.Mesh(oceanGeometry, oceanMaterial);
  ocean.rotation.x = -Math.PI / 2;
  ocean.position.y = 0;
  scene.add(ocean);

  scene.add(new THREE.AmbientLight(CONFIG.ambientColor, CONFIG.ambientIntensity));

  const beamGeometry = new THREE.ConeGeometry(
    CONFIG.beamRadius,
    CONFIG.beamLength,
    CONFIG.beamSegments,
    1,
    true
  );
  const beamMaterial = new THREE.MeshBasicMaterial({
    color: CONFIG.beamColor,
    transparent: true,
    opacity: CONFIG.beamOpacity,
    side: THREE.DoubleSide,
  });

  beamMesh = new THREE.Mesh(beamGeometry, beamMaterial);
  beamMesh.rotation.x = -Math.PI / 2;
  beamMesh.position.z = CONFIG.beamLength / 2;

  beamGroup = new THREE.Group();
  beamGroup.position.set(
    camera.position.x + CONFIG.lampOffsetX,
    camera.position.y + CONFIG.lampOffsetY,
    camera.position.z + CONFIG.lampOffsetZ
  );
  beamGroup.add(beamMesh);
  scene.add(beamGroup);

  beamLight = new THREE.SpotLight(CONFIG.beamColor, 2, CONFIG.beamLength, Math.PI / 6, 0.3);
  beamLight.position.set(0, 0, 0);
  beamLight.target.position.set(0, 0, CONFIG.beamLength);
  beamGroup.add(beamLight);
  beamGroup.add(beamLight.target);
}

setupScene();

// -----------------------------------------------------------------------------
// Ships: deterministic speed + spawn interval derived from cycle config
// -----------------------------------------------------------------------------
const shipDistance = CONFIG.shipSpawnZ - CONFIG.shipArriveZ;
const shipSpeed = shipDistance / CONFIG.cycleDuration; // <-- no randomness

const spawnWindow = Math.max(0, CONFIG.cycleSpawnEnd - CONFIG.cycleSpawnStart);
const spawnInterval =
  CONFIG.cycleShipCount <= 1 ? CONFIG.cycleDuration : spawnWindow / (CONFIG.cycleShipCount - 1);

let shipSystem = createShipSystem(scene, {
  shipCount: CONFIG.cycleShipCount,
  shipSpawnZ: CONFIG.shipSpawnZ,
  shipArriveZ: CONFIG.shipArriveZ,
  shipLaneX: CONFIG.shipLaneX,
  shipY: CONFIG.shipY,

  // Keep your ships.js API the same, but remove randomness by setting min=max
  shipSpeedMin: shipSpeed,
  shipSpeedMax: shipSpeed,

  // Spawns evenly across [cycleSpawnStart, cycleSpawnEnd]
  shipSpawnInterval: spawnInterval,
});

const rockSystem = createRockSystem(scene, {
  count: 10,
  xMin: -140,
  xMax: 140,
  zMin: 150,
  zMax: 520,
  oceanY: 0,
  minSpacing: 25,
});


// -----------------------------------------------------------------------------
// Day/night transition: looped progress
// -----------------------------------------------------------------------------
function getCycleProgress(time) {
  const tCycle = time % CONFIG.cycleDuration;
  return tCycle / CONFIG.cycleDuration; // 0..1
}

function applyDawnTransition(progress) {
  const beamOpacity = 0.35 + 0.25 * progress;
  beamMesh.material.opacity = Math.min(beamOpacity, 0.6);

  _skyColor.lerpColors(
    new THREE.Color(CONFIG.skyColorNight),
    new THREE.Color(CONFIG.skyColorDawn),
    progress
  );
  scene.background.copy(_skyColor);

  _oceanColor.lerpColors(
    new THREE.Color(CONFIG.oceanColorNight),
    new THREE.Color(CONFIG.oceanColorDawn),
    progress
  );
  oceanMaterial.color.copy(_oceanColor);

  _fogColor.lerpColors(
    new THREE.Color(CONFIG.fogColorNight),
    new THREE.Color(CONFIG.fogColorDawn),
    progress
  );
  scene.fog.color.copy(_fogColor);
}

// -----------------------------------------------------------------------------
// Beam control state + input
// -----------------------------------------------------------------------------
const beamRotation = { yaw: 0, pitch: 0 };
const keysPressed = { ArrowLeft: false, ArrowRight: false, ArrowUp: false, ArrowDown: false };

function onKeyDown(event) {
  if (event.key in keysPressed) {
    keysPressed[event.key] = true;
    event.preventDefault();
  }
}
function onKeyUp(event) {
  if (event.key in keysPressed) {
    keysPressed[event.key] = false;
    event.preventDefault();
  }
}
window.addEventListener("keydown", onKeyDown);
window.addEventListener("keyup", onKeyUp);

function updateBeamRotation() {
  if (keysPressed.ArrowLeft) beamRotation.yaw += CONFIG.beamRotationSpeed;
  if (keysPressed.ArrowRight) beamRotation.yaw -= CONFIG.beamRotationSpeed;

  const maxPitch = Math.PI / 3;
  if (keysPressed.ArrowUp && beamRotation.pitch < maxPitch) beamRotation.pitch -= CONFIG.beamRotationSpeed;
  if (keysPressed.ArrowDown && beamRotation.pitch > -maxPitch) beamRotation.pitch += CONFIG.beamRotationSpeed;

  beamGroup.rotation.order = "YXZ";
  beamGroup.rotation.y = beamRotation.yaw;
  beamGroup.rotation.x = beamRotation.pitch;
}

// -----------------------------------------------------------------------------
// Resize
// -----------------------------------------------------------------------------
window.addEventListener("resize", () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

// -----------------------------------------------------------------------------
// Loop reset (repeat cycle): reset ships at cycle boundary
// NOTE: this expects ships.js to provide shipSystem.reset().
// If you don't have it yet, add a reset() in ships.js that:
// - removes ship meshes from scene
// - clears internal arrays + counters (shipsSpawned/spawnTimer)
// -----------------------------------------------------------------------------
let lastCycleIndex = -1;

function animate() {
  const dt = Math.min(clock.getDelta(), 0.033);
  const time = clock.elapsedTime;

  const cycleIndex = Math.floor(time / CONFIG.cycleDuration);
  if (cycleIndex !== lastCycleIndex) {
    lastCycleIndex = cycleIndex;
    shipSystem.reset();
  }

  const progress = getCycleProgress(time);
  applyDawnTransition(progress);
  updateBeamRotation();

  const hits = rockSystem.checkShipCollisions(shipSystem.ships);
  if (hits.length > 0) {
   
  }

  shipSystem.update(dt, time);

  requestAnimationFrame(animate);
  renderer.render(scene, camera);
}

animate();
