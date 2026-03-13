import * as THREE from "three";
import { CONFIG, MODE } from "./config.js";

import { createPlayEnvironment, configureRendererForOcean } from "./systems/playEnvironment.js";
import { createIntroEnvironment } from "./systems/introEnvironment.js";
import { createLighthouseBeam } from "./systems/lighthouseBeam.js";
import { createIntroCamera } from "./systems/introCamera.js";
import { createCycleManager } from "./systems/cycleManager.js";
import { createShipSystem } from "./systems/ships.js";
import { createRockSystem } from "./systems/rocks.js";
//import { createSkyDome } from "./systems/sky.js";
import { RGBELoader } from "three/addons/loaders/RGBELoader.js";

// --- Simple UI overlay (countdown + game over) ---
const uiRoot = document.createElement("div");
uiRoot.style.position = "fixed";
uiRoot.style.inset = "0";
uiRoot.style.pointerEvents = "none";
uiRoot.style.zIndex = "10";
uiRoot.style.fontFamily =
  'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';
uiRoot.style.color = "#ffffff";
document.body.appendChild(uiRoot);

const countdownEl = document.createElement("div");
countdownEl.id = "countdown-timer";
countdownEl.style.position = "absolute";
countdownEl.style.top = "16px";
countdownEl.style.right = "24px";
countdownEl.style.padding = "8px 14px";
countdownEl.style.borderRadius = "6px";
countdownEl.style.background = "rgba(0, 0, 0, 0.45)";
countdownEl.style.fontSize = "22px";
countdownEl.style.letterSpacing = "0.12em";
countdownEl.style.textTransform = "uppercase";
countdownEl.style.fontWeight = "600";
countdownEl.style.boxShadow = "0 0 12px rgba(0, 0, 0, 0.6)";
countdownEl.style.display = "none";
uiRoot.appendChild(countdownEl);

const shipwreckEl = document.createElement("div");
shipwreckEl.id = "shipwreck-counter";
shipwreckEl.style.position = "absolute";
shipwreckEl.style.top = "16px";
shipwreckEl.style.left = "24px";
shipwreckEl.style.padding = "8px 14px";
shipwreckEl.style.borderRadius = "6px";
shipwreckEl.style.background = "rgba(0, 0, 0, 0.45)";
shipwreckEl.style.fontSize = "16px";
shipwreckEl.style.letterSpacing = "0.08em";
shipwreckEl.style.textTransform = "uppercase";
shipwreckEl.style.fontWeight = "500";
shipwreckEl.style.boxShadow = "0 0 12px rgba(0, 0, 0, 0.6)";
shipwreckEl.style.display = "none";
uiRoot.appendChild(shipwreckEl);

const gameOverEl = document.createElement("div");
gameOverEl.id = "game-over-overlay";
gameOverEl.style.position = "absolute";
gameOverEl.style.top = "50%";
gameOverEl.style.left = "50%";
gameOverEl.style.transform = "translate(-50%, -50%)";
gameOverEl.style.padding = "24px 40px";
gameOverEl.style.borderRadius = "10px";
gameOverEl.style.background = "rgba(6, 12, 32, 0.92)";
gameOverEl.style.border = "1px solid rgba(255, 255, 255, 0.25)";
gameOverEl.style.boxShadow = "0 18px 45px rgba(0, 0, 0, 0.75)";
gameOverEl.style.display = "none";
gameOverEl.style.textAlign = "center";
gameOverEl.style.pointerEvents = "auto";

const gameOverTitle = document.createElement("div");
gameOverTitle.textContent = "GAME OVER";
gameOverTitle.style.fontSize = "32px";
gameOverTitle.style.fontWeight = "800";
gameOverTitle.style.letterSpacing = "0.18em";
gameOverTitle.style.marginBottom = "8px";
gameOverTitle.style.textTransform = "uppercase";

const gameOverStats = document.createElement("div");
gameOverStats.style.marginTop = "8px";
gameOverStats.style.fontSize = "16px";
gameOverStats.style.opacity = "0.9";

const restartButton = document.createElement("button");
restartButton.textContent = "Restart";
restartButton.style.marginTop = "16px";
restartButton.style.padding = "8px 18px";
restartButton.style.borderRadius = "999px";
restartButton.style.border = "none";
restartButton.style.fontSize = "14px";
restartButton.style.fontWeight = "600";
restartButton.style.letterSpacing = "0.12em";
restartButton.style.textTransform = "uppercase";
restartButton.style.cursor = "pointer";
restartButton.style.background = "rgba(255, 255, 255, 0.9)";
restartButton.style.color = "#0b1224";

gameOverEl.appendChild(gameOverTitle);
gameOverEl.appendChild(gameOverStats);
gameOverEl.appendChild(restartButton);
uiRoot.appendChild(gameOverEl);

function formatCountdown(secondsRemaining) {
  const clamped = Math.max(0, secondsRemaining);
  const whole = Math.floor(clamped);
  const mins = Math.floor(whole / 60);
  const secs = whole % 60;
  const mStr = mins.toString().padStart(2, "0");
  const sStr = secs.toString().padStart(2, "0");
  return `${mStr}:${sStr}`;
}

function setCountdownVisible(visible) {
  countdownEl.style.display = visible ? "block" : "none";
}

function updateCountdownDisplay(secondsRemaining) {
  countdownEl.textContent = formatCountdown(secondsRemaining);
}

function showGameOverOverlay() {
  const survived = Math.max(0, totalShipsPlanned - shipwreckCount);
  gameOverStats.textContent = `Ships survived: ${survived} / ${totalShipsPlanned}`;
  gameOverEl.style.display = "block";
}

let shipwreckCount = 0;
let totalShipsPlanned = CONFIG.cycleShipCount;

function updateShipwreckDisplay() {
  shipwreckEl.textContent = `Shipwrecks: ${shipwreckCount}`;
}

function setShipwreckVisible(visible) {
  shipwreckEl.style.display = visible ? "block" : "none";
}

function resetShipwreckStats() {
  shipwreckCount = 0;
  totalShipsPlanned = CONFIG.cycleShipCount;
  updateShipwreckDisplay();
}

function handleShipWreck() {
  shipwreckCount += 1;
  updateShipwreckDisplay();
}

function restartGame() {
  // Hide overlay first so clicks don't stack
  gameOverEl.style.display = "none";

  // Reset existing gameplay systems if they exist
  if (shipSystem) {
    shipSystem.reset();
  }
  if (rockSystem) {
    rockSystem.reset();
  }

  // Ensure play environment is active
  introEnv.setActive(false);
  playEnv.setActive(true);

  // Reset camera to standard play pose
  camera.position.set(0, CONFIG.cameraPosY, CONFIG.cameraPosZ);
  camera.lookAt(0, 0, CONFIG.cameraLookZ);
  camera.updateMatrixWorld(true);

  const playEuler = new THREE.Euler().setFromQuaternion(camera.quaternion, "YXZ");
  currentYaw = playEuler.y;
  currentPitch = playEuler.x;
  targetYaw = currentYaw;
  targetPitch = currentPitch;
  camera.rotation.order = "YXZ";
  camera.rotation.z = 0;

  // Start a fresh play session and switch mode
  const now = clock.elapsedTime;
  startPlay(now);
  mode = MODE.PLAY;
}

restartButton.addEventListener("click", (e) => {
  e.preventDefault();
  e.stopPropagation();
  restartGame();
});

const scene = new THREE.Scene();
const clock = new THREE.Clock();
const camera = new THREE.PerspectiveCamera(
  CONFIG.cameraFov,
  window.innerWidth / window.innerHeight,
  CONFIG.cameraNear,
  CONFIG.cameraFar
);


let targetFov = camera.fov;
const minFov = 25;   // zoom in
const maxFov = 75;   // zoom out
const zoomSpeed = 5; // smoothing speed

let targetYaw = 0;
let targetPitch = 0;
let currentYaw = 0;
let currentPitch = 0;
const lookKeys = {
  KeyA: false,
  KeyD: false,
  KeyW: false,
  KeyS: false,
};

const keyLookSpeed = 1.6;
const cameraSmooth = 8;
const maxPitch = Math.PI / 3; // prevents flipping
const maxYaw = Math.PI / 2;
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap; // Soft shadows for better quality
configureRendererForOcean(renderer); // color space / tone mapping for ocean (and intro) visibility
// Canvas added only after HDR loads so first frame has real sky — one smooth transition

const rgbeLoader = new RGBELoader();
rgbeLoader.setPath("/textures/");
const FADE_DURATION_MS = 500;

rgbeLoader.load("cloudy_sky_image.hdr", (texture) => {
  texture.mapping = THREE.EquirectangularReflectionMapping;
  scene.background = texture;
  scene.environment = texture;
  document.body.appendChild(renderer.domElement);
  clock.start();
  animate();
  const loadingEl = document.getElementById("loading");
  if (loadingEl) {
    loadingEl.classList.add("fade-out");
    setTimeout(() => loadingEl.remove(), FADE_DURATION_MS);
  }
}, undefined, (err) => {
  console.error("HDR load failed:", err);
  scene.background = new THREE.Color(0x4a90e2);
  document.body.appendChild(renderer.domElement);
  clock.start();
  animate();
  const loadingEl = document.getElementById("loading");
  if (loadingEl) {
    loadingEl.classList.add("fade-out");
    setTimeout(() => loadingEl.remove(), FADE_DURATION_MS);
  }
});

// Environments
const introEnv = createIntroEnvironment(scene, renderer, CONFIG);
const playEnv = createPlayEnvironment(scene, renderer, CONFIG);
//const sky = createSkyDome(scene, renderer, CONFIG);
//sky.setColors({ dawn: 0x4a90e2, night: CONFIG.skyColorNight });
//sky.setActive(true);
//sky.setBrightness(1.4); // crank if too dark under ACES

introEnv.setActive(true);
playEnv.setActive(false);

// IMPORTANT: ensure world matrices are valid before calling getWorldPosition
scene.updateMatrixWorld(true);

// Compute intro pose ONCE
// Start: Camera far back, looking at lighthouse in front
const lighthouseCenter = introEnv.lighthouse.getAimPoint();
const lighthouseTop = introEnv.lighthouse.getTopPosition();
const introStartPos = new THREE.Vector3(0, lighthouseCenter.y + 20, 350);
const introStartLook = lighthouseCenter.clone();

// End: Camera zooms into the top of the lighthouse
const introEndPos = new THREE.Vector3(0, lighthouseTop.y - 5, 60);
const introEndLook = lighthouseTop.clone();

// Force camera into intro pose right now (so frame 1 is correct)
camera.position.copy(introStartPos);
camera.lookAt(introStartLook);

// Beam (attached to keeper camera; keep disabled in intro)
const beam = createLighthouseBeam(scene, camera, CONFIG);
beam.setEnabled(false);

// Intro camera uses the lighthouse inside introEnv
const intro = createIntroCamera(camera, {
  duration: 6,
  startPos: introStartPos.clone(),
  startLook: introStartLook.clone(),
  endPos: introEndPos.clone(),
  endLook: introEndLook.clone(),
});

// Gameplay systems created on transition
let shipSystem = null;
let rockSystem = null;
let cycle = null;
let playStartTime = null;
let countdownEndTime = null;
const PLAY_COUNTDOWN_SECONDS = 60;

function startPlay(timeNow) {
  playStartTime = timeNow;
  countdownEndTime = timeNow + PLAY_COUNTDOWN_SECONDS;

  resetShipwreckStats();
  setShipwreckVisible(true);

  // Create ships
  const shipDistance = CONFIG.shipSpawnZ - CONFIG.shipArriveZ;
  const shipSpeed = shipDistance / CONFIG.cycleDuration;

  const spawnWindow = Math.max(0, CONFIG.cycleSpawnEnd - CONFIG.cycleSpawnStart);
  const spawnInterval =
    CONFIG.cycleShipCount <= 1
      ? CONFIG.cycleDuration
      : spawnWindow / (CONFIG.cycleShipCount - 1);

  shipSystem = createShipSystem(scene, {
    shipCount: CONFIG.cycleShipCount,
    shipSpawnZ: CONFIG.shipSpawnZ,
    shipArriveZ: CONFIG.shipArriveZ,
    shipLaneX: CONFIG.shipLaneX,
    shipSpawnXMin: CONFIG.shipSpawnXMin,
    shipSpawnXMax: CONFIG.shipSpawnXMax,
    shipY: CONFIG.shipY,
    shipSpeedMin: shipSpeed,
    shipSpeedMax: shipSpeed,
    shipSpawnInterval: spawnInterval,
    onShipWreck: handleShipWreck,
  });

  // Create rocks
  rockSystem = createRockSystem(scene, {
    count: 10,
    xMin: -140,
    xMax: 140,
    zMin: 150,
    zMax: 520,
    oceanY: 0,
    minSpacing: 25,
    envMap: scene.environment,
    onShipWreck: handleShipWreck,
  });

  // Cycle manager AFTER ships exist
  cycle = createCycleManager(CONFIG, () => shipSystem.reset());

  beam.setEnabled(true);
  beam.resetAim?.();

  setCountdownVisible(true);
  updateCountdownDisplay(PLAY_COUNTDOWN_SECONDS);
}

let mode = MODE.INTRO;
let introStartTime = null;

window.addEventListener("resize", () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

window.addEventListener("wheel", (e) => {
  // prevent page scrolling
  e.preventDefault();

  const zoomSensitivity = 0.05;

  targetFov += e.deltaY * zoomSensitivity;
  targetFov = THREE.MathUtils.clamp(targetFov, minFov, maxFov);

}, { passive: false });

window.addEventListener("keydown", (e) => {
  if (e.code in lookKeys) {
    lookKeys[e.code] = true;
    e.preventDefault();
  }
});

window.addEventListener("keyup", (e) => {
  if (e.code in lookKeys) {
    lookKeys[e.code] = false;
    e.preventDefault();
  }
});

function animate() {
  const dt = Math.min(clock.getDelta(), 0.033);
  const time = clock.elapsedTime;

  try {
    if (mode === MODE.INTRO) {
      if (introStartTime === null) {
        introStartTime = time;
      }
      const finished = intro.update(time);
      camera.updateMatrixWorld(true);

      const introProgress = Math.min(1.0, (time - introStartTime) / 6.0);
      introEnv.updateSunset(introProgress, time);
     // sky.setDawn(1.0 - introProgress);
     // sky.setBrightness(1.6);
     // sky.update(camera, null, time);

      if (finished) {
        mode = MODE.PLAY;

        introEnv.setActive(false);
        playEnv.setActive(true);
        
        camera.position.set(0, CONFIG.cameraPosY, CONFIG.cameraPosZ);
        camera.lookAt(0, 0, CONFIG.cameraLookZ);

        camera.updateMatrixWorld(true);

        const playEuler = new THREE.Euler().setFromQuaternion(camera.quaternion, "YXZ");
        currentYaw = playEuler.y;
        currentPitch = playEuler.x;
        targetYaw = currentYaw;
        targetPitch = currentPitch;
        camera.rotation.order = "YXZ";
        camera.rotation.z = 0;  

        startPlay(time);
      }
    } else if (mode === MODE.PLAY) {
      const tPlay = time - playStartTime;

      const prog = cycle.update(tPlay);
      playEnv.applyDawn(prog);   
     // sky.setDawn(prog);
     // sky.setBrightness(1.4);
     // sky.update(camera, null, tPlay);
      beam.setOpacityForProgress(prog);
      beam.update();
      const spot = beam.getSpotCenterOnPlane(CONFIG.shipY);
      shipSystem.update(dt, tPlay, spot);
      playEnv.update(tPlay, camera);
      const hits = rockSystem.checkShipCollisions(shipSystem.ships);
      if (hits.length) {
        // ...
      }

      // Countdown timer and transition to END_GAME
      if (countdownEndTime != null) {
        const remaining = Math.max(0, countdownEndTime - time);
        updateCountdownDisplay(remaining);
        if (remaining <= 0) {
          mode = MODE.END_GAME;
          showGameOverOverlay();
        }
      }
    } else if (mode === MODE.END_GAME) {
      // Keep scene and camera active but freeze gameplay systems
      if (playStartTime != null) {
        const tPlay = time - playStartTime;
        playEnv.update(tPlay, camera);
      }
      // Ensure countdown shows 00:00
      updateCountdownDisplay(0);
    }
    camera.fov = THREE.MathUtils.lerp(camera.fov, targetFov, dt * zoomSpeed);
    camera.updateProjectionMatrix();

    if (mode === MODE.PLAY) {
      if (lookKeys.KeyA) targetYaw += keyLookSpeed * dt;
      if (lookKeys.KeyD) targetYaw -= keyLookSpeed * dt;
      if (lookKeys.KeyW) targetPitch += keyLookSpeed * dt;
      if (lookKeys.KeyS) targetPitch -= keyLookSpeed * dt;

      targetPitch = THREE.MathUtils.clamp(targetPitch, -maxPitch, maxPitch);
      targetYaw = THREE.MathUtils.clamp(targetYaw, CONFIG.beamInitialYaw - 0.75, CONFIG.beamInitialYaw + 0.75);

      currentYaw = THREE.MathUtils.lerp(currentYaw, targetYaw, dt * cameraSmooth);
      currentPitch = THREE.MathUtils.lerp(currentPitch, targetPitch, dt * cameraSmooth);

      camera.rotation.order = "YXZ";
      camera.rotation.y = currentYaw;
      camera.rotation.x = currentPitch;
    }

    requestAnimationFrame(animate);
    renderer.render(scene, camera);
  } catch (err) {
    console.error("Animation loop crashed:", err);
  }
}
// animate() is started only after HDR loads (see rgbeLoader.load callback)
