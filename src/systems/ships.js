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

// Factory that manages spawning + updating ships
export function createShipSystem(scene, {
  shipCount = 3,
  shipSpawnZ = 550,
  shipArriveZ = 30,
  shipLaneX = [-80, 0, 80],
  shipY = 0.6,
  shipSpeedMin = 30,
  shipSpeedMax = 55,
  shipSpawnInterval = 2.0,
} = {}) {
  const ships = [];
  let shipsSpawned = 0;
  let spawnTimer = 0;

  function spawnShip() {
    if (shipsSpawned >= shipCount) return;

    const mesh = makeShipMesh();
    const laneIndex = shipsSpawned % shipLaneX.length;

    mesh.position.set(shipLaneX[laneIndex], shipY, shipSpawnZ);
    mesh.rotation.y = Math.PI; // face toward -Z (toward shore)

    const speed = THREE.MathUtils.randFloat(shipSpeedMin, shipSpeedMax);

    ships.push({
      mesh,
      speed,
      bobPhase: Math.random() * Math.PI * 2,
      active: true,
    });

    scene.add(mesh);
    shipsSpawned += 1;
  }

  function update(dt, time) {
    // spawn over time
    spawnTimer += dt;
    if (shipsSpawned < shipCount && spawnTimer >= shipSpawnInterval) {
      spawnTimer = 0;
      spawnShip();
    }

    // move toward shore
    for (const s of ships) {
      if (!s.active) continue;

      s.mesh.position.z -= s.speed * dt;
      s.mesh.position.y = shipY + 0.15 * Math.sin(time * 2.0 + s.bobPhase);

      if (s.mesh.position.z <= shipArriveZ) {
        s.active = false;
        s.mesh.visible = false; // placeholder "arrived"
      }
    }
  }

  function reset() {
  for (const s of ships) scene.remove(s.mesh);
  ships.length = 0;
  shipsSpawned = 0;
  spawnTimer = 0;
  }

  return {
    ships,
    spawnShip,
    update,
    reset
  };
}
