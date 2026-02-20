// ships.js
import * as THREE from "three";

function makeShipMesh() {
  const ship = new THREE.Group();

  const hull = new THREE.Mesh(
    new THREE.BoxGeometry(10, 2, 18),
    new THREE.MeshBasicMaterial({ color: 0x8b5a2b })
  );
  hull.position.y = 1;
  ship.add(hull);

  const cabin = new THREE.Mesh(
    new THREE.BoxGeometry(6, 3, 6),
    new THREE.MeshBasicMaterial({ color: 0xd9d9d9 })
  );
  cabin.position.set(0, 3, -2);
  ship.add(cabin);

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
    shipSpawnXMin = -120,
    shipSpawnXMax = 120,
    shipY = 0.6,
    shipSpeedMin = 30,
    shipSpeedMax = 55,
    shipSpawnInterval = 2.0,
    shipTurnRate = 2.5, // radians/sec

    // NEW: gameplay control radius (in world units) around spotlight center
    // Ship steers if it intersects this circle on the ocean plane.
    spotRange = 90,
  } = {}
) {
  const ships = [];
  let shipsSpawned = 0;
  let spawnTimer = shipSpawnInterval;

  function spawnShip() {
    if (shipsSpawned >= shipCount) return;

    const mesh = makeShipMesh();
    const randomX = THREE.MathUtils.randFloat(shipSpawnXMin, shipSpawnXMax);

    mesh.position.set(randomX, shipY, shipSpawnZ);
    mesh.rotation.y = Math.PI; // faces toward -Z visually

    const speed = THREE.MathUtils.randFloat(shipSpeedMin, shipSpeedMax);

    // heading toward shore initially (-Z)
    const direction = new THREE.Vector3(0, 0, -1);

    // bounding sphere radius ONCE so partial overlap counts
    mesh.updateMatrixWorld(true);
    tmpBox.setFromObject(mesh);
    tmpBox.getBoundingSphere(tmpSphere);
    const radius = tmpSphere.radius;

    ships.push({
      mesh,
      speed,
      direction,
      turnRate: shipTurnRate,
      radius,
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
      if (spotCenter && shipIntersectsSpot(s.mesh.position, s.radius, spotCenter, spotRange)) {
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
            s.direction.y = 0;
            s.direction.normalize();
          }
        }
      }

      // --- Move forward along heading ---
      s.mesh.position.addScaledVector(s.direction, s.speed * dt);

      // --- Bobbing ---
      s.mesh.position.y = shipY + 0.15 * Math.sin(time * 2.0 + s.bobPhase);

      // --- Face movement direction without allocations ---
      tmpLook.copy(s.mesh.position).add(s.direction);
      s.mesh.lookAt(tmpLook);

      // arrival
      if (s.mesh.position.z <= shipArriveZ) {
        s.active = false;
        s.mesh.visible = false;
      }
    }
  }

  function reset() {
    for (const s of ships) scene.remove(s.mesh);
    ships.length = 0;
    shipsSpawned = 0;
    spawnTimer = shipSpawnInterval;
  }

  return { ships, spawnShip, update, reset };
}