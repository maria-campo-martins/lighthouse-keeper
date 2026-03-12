// ships.js
import * as THREE from "three";

function clampDirectionToShore(dir) {
  dir.y = 0;

  // Never allow the ship to point backward (+Z)
  if (dir.z > -0.001) {
    dir.z = -0.001;
  }

  if (dir.lengthSq() > 1e-8) {
    dir.normalize();
  } else {
    dir.set(0, 0, -1);
  }

  return dir;
}

function deactivateShip(scene, ship) {
  if (!ship.active) return;
  ship.active = false;
  ship.mesh.visible = false;
  scene.remove(ship.mesh); // optional, but cleaner than just hiding
}

function getShipXZRadiusFromBox(localBox) {
  const size = new THREE.Vector3();
  localBox.getSize(size);
  return 0.5 * Math.max(size.x, size.z);
}

function shuffleArray(arr) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

function buildLaneQueue(lanes) {
  return shuffleArray([...lanes]);
}

function makeShipMesh() {
  const ship = new THREE.Group();

  // -----------------------------
  // Materials (PBR + reacts to light)
  // -----------------------------
  const hullMat = new THREE.MeshStandardMaterial({
    color: 0x6b4a2d,
    roughness: 0.85,
    metalness: 0.05,
  });

  const deckMat = new THREE.MeshStandardMaterial({
    color: 0x3a2a1a,
    roughness: 0.95,
    metalness: 0.0,
  });

  const cabinMat = new THREE.MeshStandardMaterial({
    color: 0xd6d6d6,
    roughness: 0.7,
    metalness: 0.05,
  });

  const windowMat = new THREE.MeshStandardMaterial({
    color: 0x111111,
    emissive: 0xffcc66,
    emissiveIntensity: 1.2,
    roughness: 0.2,
    metalness: 0.0,
  });

  const metalMat = new THREE.MeshStandardMaterial({
    color: 0x555555,
    roughness: 0.4,
    metalness: 0.9,
  });

  // -----------------------------
  // Hull: a tapered box (boat-like)
  // -----------------------------
  const hullGeo = new THREE.BoxGeometry(10, 2, 18, 2, 1, 6);

  // Taper the bow (front, +Z) and slightly taper the stern (-Z)
  const pos = hullGeo.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    const y = pos.getY(i);
    const z = pos.getZ(i);

    // z goes from -9..+9
    const t = (z + 9) / 18; // 0 at stern, 1 at bow

    // Width taper: narrower at bow, a touch narrower at stern
    const widthScale = THREE.MathUtils.lerp(0.78, 0.35, t); // stern->bow
    pos.setX(i, x * widthScale);

    // Give a mild "keel" by pulling bottom vertices inward a bit
    if (y < 0) pos.setX(i, pos.getX(i) * 0.9);
  }
  hullGeo.computeVertexNormals();

  const hull = new THREE.Mesh(hullGeo, hullMat);
  hull.position.y = 1;
  ship.add(hull);

  // Bow tip (small wedge)
  const bow = new THREE.Mesh(new THREE.ConeGeometry(2.2, 3.0, 8, 1), hullMat);
  bow.rotation.x = Math.PI * 0.5;
  bow.position.set(0, 1.0, 10.0);
  ship.add(bow);

  // Deck slab
  const deck = new THREE.Mesh(new THREE.BoxGeometry(8.5, 0.35, 15), deckMat);
  deck.position.set(0, 2.05, 0.0);
  ship.add(deck);

  // -----------------------------
  // Cabin + windows
  // -----------------------------
  const cabin = new THREE.Mesh(new THREE.BoxGeometry(5.8, 2.8, 5.8), cabinMat);
  cabin.position.set(0, 3.35, -2.2);
  ship.add(cabin);

  const window1 = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.8, 0.05), windowMat);
  window1.position.set(-1.6, 3.55, 0.75);
  ship.add(window1);

  const window2 = window1.clone();
  window2.position.x = 1.6;
  ship.add(window2);

  // Smokestack
  const stack = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.45, 2.2, 10), metalMat);
  stack.position.set(1.6, 5.0, -3.2);
  ship.add(stack);

  // Rail posts (tiny detail, big realism)
  const postGeo = new THREE.CylinderGeometry(0.06, 0.06, 0.7, 6);
  for (let i = 0; i < 8; i++) {
    const z = THREE.MathUtils.lerp(-6.5, 6.5, i / 7);
    const left = new THREE.Mesh(postGeo, metalMat);
    left.position.set(-4.2, 2.55, z);
    ship.add(left);

    const right = new THREE.Mesh(postGeo, metalMat);
    right.position.set(4.2, 2.55, z);
    ship.add(right);
  }

  // Make shadows possible if your renderer/lights are set up
  ship.traverse((o) => {
    if (o.isMesh) {
      o.castShadow = true;
      o.receiveShadow = true;
    }
  });

  ship.updateMatrixWorld(true);
  ship.userData.localBox = new THREE.Box3().setFromObject(ship);

  return ship;
}

const UP = new THREE.Vector3(0, 1, 0);

// temps (avoid per-frame allocations)
const tmpBox = new THREE.Box3();
const tmpSphere = new THREE.Sphere();

const tmpDesired = new THREE.Vector3();
const tmpCurXZ = new THREE.Vector3();
const tmpLook = new THREE.Vector3();

// circle-circle intersection in XZ plane
function shipIntersectsSpot(shipPos, shipR, spotCenter, spotR) {
  const dx = shipPos.x - spotCenter.x;
  const dz = shipPos.z - spotCenter.z;
  const dist2 = dx * dx + dz * dz;
  const r = shipR + spotR;
  return dist2 <= r * r;
}

export function createShipSystem(
  scene,
  {
    shipCount = 3,
    shipSpawnZ = 550,
    shipArriveZ = 30,

    shipLanes = [-250, -150, -50, 50, 150, 250],

    shipY = 0.6,
    shipSpeedMin = 30,
    shipSpeedMax = 55,
    shipSpawnInterval = 2.0,
    shipTurnRate = 2.5,
    spotRange = 90,
  } = {}
) {
  const ships = [];
  let shipsSpawned = 0;
  let spawnTimer = shipSpawnInterval;

  let laneQueue = buildLaneQueue(shipLanes);

  function getNextSpawnX() {
    if (laneQueue.length === 0) {
      laneQueue = buildLaneQueue(shipLanes);
    }
    return laneQueue.pop();
  }

  function spawnShip() {
    if (shipsSpawned >= shipCount) return;

    const mesh = makeShipMesh();
    const spawnX = getNextSpawnX();
    mesh.position.set(spawnX, shipY, shipSpawnZ);

    mesh.rotation.y = Math.PI; // faces toward -Z visually

    const speed = THREE.MathUtils.randFloat(shipSpeedMin, shipSpeedMax);

    // heading toward shore initially (-Z)
    const direction = new THREE.Vector3(0, 0, -1);

    // local-space box computed once when the ship mesh was created
    const localBox = mesh.userData.localBox.clone();
    const worldBox = new THREE.Box3();
    const xzRadius = getShipXZRadiusFromBox(localBox);
    
    ships.push({
      mesh,
      speed,
      direction,
      turnRate: shipTurnRate,
      localBox,
      worldBox,
      xzRadius,
      bobPhase: Math.random() * Math.PI * 2,
      active: true,
    });

    scene.add(mesh);
    shipsSpawned += 1;
  }
  
  // update signature now expects spotlight center on the ocean plane (Vector3 or null)
  // Pass this from main.js: shipSystem.update(dt, tPlay, beam.getSpotCenterOnPlane(shipY))
  function update(dt, time, spotCenter = null) {
    // spawn over time
    spawnTimer += dt;
    if (shipsSpawned < shipCount && spawnTimer >= shipSpawnInterval) {
      spawnTimer = 0;
      spawnShip();
    }

    for (const s of ships) {
      if (!s.active) continue;

      // --- Steering: if ship intersects control circle around spotlight center, steer toward it ---
      if (spotCenter && shipIntersectsSpot(s.mesh.position, s.xzRadius, spotCenter, spotRange)) {
        // desired heading = ship -> spotlight center (XZ only)
        tmpDesired.subVectors(spotCenter, s.mesh.position);
        tmpDesired.y = 0;

        if (tmpDesired.lengthSq() > 1e-6) {
          tmpDesired.normalize();

          // current heading projected onto XZ
          tmpCurXZ.copy(s.direction);
          tmpCurXZ.y = 0;
          if (tmpCurXZ.lengthSq() > 1e-6) tmpCurXZ.normalize();

          // angle between current and desired
          const dot = THREE.MathUtils.clamp(tmpCurXZ.dot(tmpDesired), -1, 1);
          const ang = Math.acos(dot);

          if (ang > 1e-4) {
            // signed rotation direction from 2D cross (y component)
            const crossY = tmpCurXZ.x * tmpDesired.z - tmpCurXZ.z * tmpDesired.x;

            const maxStep = s.turnRate * dt;
            const step = -Math.sign(crossY) * Math.min(maxStep, ang);

            s.direction.applyAxisAngle(UP, step);
            clampDirectionToShore(s.direction);
          }
        }
      }

      // --- Move forward along heading ---
      clampDirectionToShore(s.direction);
      s.mesh.position.addScaledVector(s.direction, s.speed * dt);

      // --- Bobbing ---
      s.mesh.position.y = shipY + 0.15 * Math.sin(time * 2.0 + s.bobPhase);

      // --- Face movement direction without allocations ---
      tmpLook.copy(s.mesh.position).add(s.direction);
      s.mesh.lookAt(tmpLook);

      s.mesh.updateMatrixWorld(true);
      s.worldBox.copy(s.localBox).applyMatrix4(s.mesh.matrixWorld);

      // arrival
      if (s.mesh.position.z <= shipArriveZ) {
        deactivateShip(scene, s);
      }
    }

    // --- Ship-ship collisions ---
    for (let i = 0; i < ships.length; i++) {
      const a = ships[i];
      if (!a.active) continue;

      for (let j = i + 1; j < ships.length; j++) {
        const b = ships[j];
        if (!b.active) continue;

        if (a.worldBox.intersectsBox(b.worldBox)) {
          deactivateShip(scene, a);
          deactivateShip(scene, b);
          break; // a is gone, stop checking it
        }
      }
    }
  }

  function reset() {
    for (const s of ships) scene.remove(s.mesh);
    ships.length = 0;
    shipsSpawned = 0;
    spawnTimer = shipSpawnInterval;
    laneQueue = buildLaneQueue(shipLanes);
  }

  return { ships, spawnShip, update, reset };
}