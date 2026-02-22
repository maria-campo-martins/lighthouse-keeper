import * as THREE from "three";
import { CONFIG, MODE } from "./config.js";

import { createPlayEnvironment } from "./systems/playEnvironment.js";
import { createIntroEnvironment } from "./systems/introEnvironment.js";
import { createLighthouseBeam } from "./systems/lighthouseBeam.js";
import { createIntroCamera } from "./systems/introCamera.js";
import { createCycleManager } from "./systems/cycleManager.js";
import { createShipSystem } from "./systems/ships.js";
import { createRockSystem } from "./systems/rocks.js";

const scene = new THREE.Scene();
const clock = new THREE.Clock();

const camera = new THREE.PerspectiveCamera(
  CONFIG.cameraFov,
  window.innerWidth / window.innerHeight,
  CONFIG.cameraNear,
  CONFIG.cameraFar
);

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap; // Soft shadows for better quality
document.body.appendChild(renderer.domElement);

// Environments
const introEnv = createIntroEnvironment(scene, renderer, CONFIG);
const playEnv = createPlayEnvironment(scene, renderer, CONFIG);

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

function startPlay(timeNow) {
  playStartTime = timeNow;

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
  });

  // Cycle manager AFTER ships exist
  cycle = createCycleManager(CONFIG, () => shipSystem.reset());

  beam.setEnabled(true);
  beam.resetAim?.();
}

let mode = MODE.INTRO;
let introStartTime = null;

window.addEventListener("resize", () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
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
      
      // Update sunset animation (sun setting)
      const introProgress = Math.min(1.0, (time - introStartTime) / 6.0);
      introEnv.updateSunset(introProgress);

      // Night moonlight look (introEnv already set background/fog/lights)
      // If your playEnv also has applyDawn, DON'T call it here.

      if (finished) {
        mode = MODE.PLAY;

        introEnv.setActive(false);
        playEnv.setActive(true);

        camera.position.set(0, CONFIG.cameraPosY, CONFIG.cameraPosZ);
        camera.lookAt(0, 0, CONFIG.cameraLookZ);

        startPlay(time);
      }
    } else {
      const tPlay = time - playStartTime;

      const prog = cycle.update(tPlay);
      playEnv.applyDawn(prog);   

      beam.setOpacityForProgress(prog);
      beam.update();
      const spot = beam.getSpotCenterOnPlane(CONFIG.shipY ?? CONFIG.shipY);
      shipSystem.update(dt, tPlay, spot);
      playEnv.update(tPlay);
      const hits = rockSystem.checkShipCollisions(shipSystem.ships);
      if (hits.length) {
        // ...
      }
    }

    renderer.render(scene, camera);
    requestAnimationFrame(animate);
  } catch (err) {
    console.error("Animation loop crashed:", err);
  }
}
animate();
