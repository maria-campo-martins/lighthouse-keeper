import * as THREE from "three";

// -----------------------------------------------------------------------------
// Constants: night scene and day/night transition
// -----------------------------------------------------------------------------
const CONFIG = {
  // Lighthouse keeper camera (eye space: view from the tower)
  cameraHeight: 4,
  cameraFov: 60,
  cameraNear: 0.1,
  cameraFar: 2000,

  // Ocean plane (world space: horizon in front of the keeper)
  oceanSize: 1200,
  oceanSegments: 32,

  // Night atmosphere — visible dark blues so horizon is clear from the start
  // Sky = slightly lighter (top), ocean = darker (bottom) → clear horizon line
  ambientIntensity: 0.15,
  ambientColor: 0x1a1a2e,
  skyColorNight: 0x0a1428,   // dark blue (top)
  oceanColorNight: 0x030a17,  // darker blue (bottom)
  fogNear: 400,
  fogFar: 1200,
  fogColorNight: 0x080c18,

  // Dawn (end of 30s transition)
  skyColorDawn: 0x87ceeb,
  oceanColorDawn: 0x0d4d87,
  fogColorDawn: 0x87ceeb,

  // Transition duration (seconds) — stays dark longer, then fades to dawn
  nightDuration: 90,

  // Lighthouse beam (flashlight: apex at lamp, cone extends outward)
  beamLength: 800,
  beamRadius: 50,       // radius of illuminated circle at horizon
  beamSegments: 24,
  beamColor: 0xffffaa,
  beamOpacity: 0.35,
  beamRotationSpeed: 0.02,
  // Lamp position: bottom center of screen (in front of viewer, at horizon level)
  lampOffsetX: 0,
  lampOffsetY: -1.5,    // below camera eye level
  lampOffsetZ: 3,      // in front of viewer
};

// -----------------------------------------------------------------------------
// Scene, camera, renderer
// -----------------------------------------------------------------------------
const scene = new THREE.Scene();

const camera = new THREE.PerspectiveCamera(
  CONFIG.cameraFov,
  window.innerWidth / window.innerHeight,
  CONFIG.cameraNear,
  CONFIG.cameraFar
);
camera.position.set(0, CONFIG.cameraHeight, 0);
camera.lookAt(0, 0, 1000);

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
let beamGroup;   // contains cone; positioned at lamp, rotated by user input
let beamMesh;
let beamLight;

// -----------------------------------------------------------------------------
// Night environment: sky, ocean, fog, lighting
// -----------------------------------------------------------------------------
function setupScene() {
  // Sky: background (top of screen) — starts dark blue, lightens at dawn
  scene.background = new THREE.Color(CONFIG.skyColorNight);

  // Fog: interpolates with time
  fogRef = new THREE.Fog(CONFIG.fogColorNight, CONFIG.fogNear, CONFIG.fogFar);
  scene.fog = fogRef;

  // Ocean: large XZ plane at y = 0 (bottom of view = horizon)
  const oceanGeometry = new THREE.PlaneGeometry(
    CONFIG.oceanSize,
    CONFIG.oceanSize,
    CONFIG.oceanSegments,
    CONFIG.oceanSegments
  );
  // Use MeshBasicMaterial so ocean color is visible without lighting
  // This ensures the ocean transitions properly and is always visible
  oceanMaterial = new THREE.MeshBasicMaterial({
    color: CONFIG.oceanColorNight,
  });
  const ocean = new THREE.Mesh(oceanGeometry, oceanMaterial);
  ocean.rotation.x = -Math.PI / 2;
  ocean.position.y = 0;
  scene.add(ocean);

  // Dim ambient; beam will provide main light later
  scene.add(new THREE.AmbientLight(CONFIG.ambientColor, CONFIG.ambientIntensity));

  // Lighthouse beam: cone like a flashlight — apex at lamp, base = illuminated circle
  // ConeGeometry: apex at +Y, base at -Y. We rotate so apex at origin, base extends in +Z.
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
  // Cone apex at +Y, base at -Y. Rotate so apex at origin, base in +Z.
  beamMesh.rotation.x = -Math.PI / 2;
  // Shift so apex (was at +height/2) is at group origin
  beamMesh.position.z = CONFIG.beamLength / 2;

  beamGroup = new THREE.Group();
  // Lamp in world space: in front of camera, at bottom center of view
  // Camera at (0, cameraHeight, 0); lamp below and in front
  beamGroup.position.set(
    CONFIG.lampOffsetX,
    CONFIG.cameraHeight + CONFIG.lampOffsetY,
    CONFIG.lampOffsetZ
  );
  beamGroup.add(beamMesh);
  scene.add(beamGroup);

  // Spotlight to illuminate the ocean where beam hits
  beamLight = new THREE.SpotLight(CONFIG.beamColor, 2, CONFIG.beamLength, Math.PI / 6, 0.3);
  beamLight.position.set(0, 0, 0);
  beamLight.target.position.set(0, 0, CONFIG.beamLength);
  beamGroup.add(beamLight);
  beamGroup.add(beamLight.target);
}

setupScene();

// -----------------------------------------------------------------------------
// Day/night transition: drive by real time, not frame count
// -----------------------------------------------------------------------------
let startTime = null;

function getDawnProgress() {
  if (startTime === null) startTime = performance.now();
  const elapsed = (performance.now() - startTime) / 1000; // seconds
  return Math.min(elapsed / CONFIG.nightDuration, 1);
}

function applyDawnTransition(progress) {
  if (progress <= 0) return;

  // Beam stays visible for entire night-to-dawn; boost opacity at dawn so it remains visible against lighter sky
  const beamOpacity = 0.35 + 0.25 * progress;
  beamMesh.material.opacity = Math.min(beamOpacity, 0.6);

  // Lerp sky (background) — instance method, not static
  _skyColor.lerpColors(
    new THREE.Color(CONFIG.skyColorNight),
    new THREE.Color(CONFIG.skyColorDawn),
    progress
  );
  scene.background.copy(_skyColor);

  // Lerp ocean material color
  _oceanColor.lerpColors(
    new THREE.Color(CONFIG.oceanColorNight),
    new THREE.Color(CONFIG.oceanColorDawn),
    progress
  );
  oceanMaterial.color.copy(_oceanColor);

  // Lerp fog color so distant ocean blends with sky
  _fogColor.lerpColors(
    new THREE.Color(CONFIG.fogColorNight),
    new THREE.Color(CONFIG.fogColorDawn),
    progress
  );
  scene.fog.color.copy(_fogColor);
}

// -----------------------------------------------------------------------------
// Lighthouse beam control state
// -----------------------------------------------------------------------------
const beamRotation = {
  yaw: 0,   // left/right rotation (around Y axis)
  pitch: 0, // up/down rotation (around X axis)
};

const keysPressed = {
  ArrowLeft: false,
  ArrowRight: false,
  ArrowUp: false,
  ArrowDown: false,
};

// -----------------------------------------------------------------------------
// Keyboard input handling
// -----------------------------------------------------------------------------
function onKeyDown(event) {
  switch (event.key) {
    case "ArrowLeft":
      keysPressed.ArrowLeft = true;
      event.preventDefault();
      break;
    case "ArrowRight":
      keysPressed.ArrowRight = true;
      event.preventDefault();
      break;
    case "ArrowUp":
      keysPressed.ArrowUp = true;
      event.preventDefault();
      break;
    case "ArrowDown":
      keysPressed.ArrowDown = true;
      event.preventDefault();
      break;
  }
}

function onKeyUp(event) {
  switch (event.key) {
    case "ArrowLeft":
      keysPressed.ArrowLeft = false;
      event.preventDefault();
      break;
    case "ArrowRight":
      keysPressed.ArrowRight = false;
      event.preventDefault();
      break;
    case "ArrowUp":
      keysPressed.ArrowUp = false;
      event.preventDefault();
      break;
    case "ArrowDown":
      keysPressed.ArrowDown = false;
      event.preventDefault();
      break;
  }
}

window.addEventListener("keydown", onKeyDown);
window.addEventListener("keyup", onKeyUp);

// -----------------------------------------------------------------------------
// Update beam rotation based on keyboard input
// -----------------------------------------------------------------------------
function updateBeamRotation() {
  // Left/Right: rotate around Y axis (yaw)
  if (keysPressed.ArrowLeft) {
    beamRotation.yaw += CONFIG.beamRotationSpeed;
  }
  if (keysPressed.ArrowRight) {
    beamRotation.yaw -= CONFIG.beamRotationSpeed;
  }

  // Up/Down: rotate around X axis (pitch)
  // Limit pitch to prevent beam from pointing too far up or down
  const maxPitch = Math.PI / 3; // 60 degrees
  if (keysPressed.ArrowUp && beamRotation.pitch < maxPitch) {
    beamRotation.pitch += CONFIG.beamRotationSpeed;
  }
  if (keysPressed.ArrowDown && beamRotation.pitch > -maxPitch) {
    beamRotation.pitch -= CONFIG.beamRotationSpeed;
  }

  // Apply yaw (left/right) and pitch (up/down) to beam group
  // Beam points along +Z by default; rotations aim it like a flashlight
  beamGroup.rotation.order = "YXZ"; // yaw first, then pitch
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
// Render loop
// -----------------------------------------------------------------------------
function animate() {
  const progress = getDawnProgress();
  applyDawnTransition(progress);
  updateBeamRotation();

  requestAnimationFrame(animate);
  renderer.render(scene, camera);
}

animate();
