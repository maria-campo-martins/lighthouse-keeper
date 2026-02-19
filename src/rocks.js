// rocks.js
import * as THREE from "three";

// ---------- helpers ----------
function randRange(min, max) {
  return min + Math.random() * (max - min);
}

function makeRockMesh({ radius = 6 } = {}) {
  // Low-poly rock-ish shape
  const geo = new THREE.IcosahedronGeometry(radius, 0);
  const mat = new THREE.MeshBasicMaterial({ color: 0x2e2e2e });
  const mesh = new THREE.Mesh(geo, mat);

  // Squash/scale a bit so they aren't perfect spheres
  mesh.scale.set(randRange(0.8, 1.4), randRange(0.5, 1.0), randRange(0.8, 1.4));
  mesh.rotation.set(randRange(0, Math.PI), randRange(0, Math.PI), randRange(0, Math.PI));

  return mesh;
}

function getShipApproxSphere(shipMesh, outSphere) {
  // Cheap ship collider: a sphere around the whole ship group
  // NOTE: calling setFromObject is a little expensive but fine for 3 ships.
  const box = new THREE.Box3().setFromObject(shipMesh);
  box.getBoundingSphere(outSphere);
  return outSphere;
}

// ---------- public API ----------
export function createRockSystem(scene, {
  count = 8,
  // Placement region (world space)
  xMin = -200,
  xMax = 200,
  zMin = 120,
  zMax = 520,

  // Ocean height (your ocean plane is y=0)
  oceanY = 0,

  // Rock sizing
  rockRadiusMin = 5,
  rockRadiusMax = 14,

  // Keep rocks from spawning too close to lanes/shore if you want
  minSpacing = 20, // between rocks
} = {}) {
  const rocks = [];

  // store as bounding spheres in world space
  // rock.collider = { center: Vector3, radius: number }
  function addRockAt(x, z, radius) {
    const mesh = makeRockMesh({ radius });
    mesh.position.set(x, oceanY + radius * 0.25, z); // slightly above water

    // collider is a sphere in world space (static)
    const collider = {
      center: new THREE.Vector3(x, oceanY + radius * 0.25, z),
      radius: radius * 0.9, // slightly forgiving
    };

    rocks.push({ mesh, collider });
    scene.add(mesh);
  }

  function isFarEnough(x, z) {
    for (const r of rocks) {
      const dx = x - r.collider.center.x;
      const dz = z - r.collider.center.z;
      const d2 = dx * dx + dz * dz;
      const minD = (minSpacing + r.collider.radius);
      if (d2 < minD * minD) return false;
    }
    return true;
  }

  // spawn rocks
  let tries = 0;
  while (rocks.length < count && tries < count * 50) {
    tries++;
    const x = randRange(xMin, xMax);
    const z = randRange(zMin, zMax);
    const radius = randRange(rockRadiusMin, rockRadiusMax);

    if (!isFarEnough(x, z)) continue;
    addRockAt(x, z, radius);
  }

  // Collision check: rocks (static spheres) vs ships (approx spheres)
  // Returns array of collision events: [{ shipIndex, rockIndex }]
  const _shipSphere = new THREE.Sphere(new THREE.Vector3(), 1);

  function checkShipCollisions(ships, {
    // optional behavior knobs
    markCrashed = true,
    hideOnCrash = true,
  } = {}) {
    const hits = [];

    for (let si = 0; si < ships.length; si++) {
      const ship = ships[si];
      if (!ship || !ship.mesh) continue;

      // If your ship system uses flags, respect them
      if (ship.crashed || ship.active === false) continue;
      if (ship.mesh.visible === false) continue;

      getShipApproxSphere(ship.mesh, _shipSphere);

      for (let ri = 0; ri < rocks.length; ri++) {
        const rock = rocks[ri];
        const dx = _shipSphere.center.x - rock.collider.center.x;
        const dy = _shipSphere.center.y - rock.collider.center.y;
        const dz = _shipSphere.center.z - rock.collider.center.z;
        const rSum = _shipSphere.radius + rock.collider.radius;

        if (dx * dx + dy * dy + dz * dz <= rSum * rSum) {
          hits.push({ shipIndex: si, rockIndex: ri });

          if (markCrashed) ship.crashed = true;
          if (hideOnCrash) ship.mesh.visible = false;

          // stop checking other rocks for this ship after first hit
          break;
        }
      }
    }

    return hits;
  }

  function reset() {
    for (const r of rocks) scene.remove(r.mesh);
    rocks.length = 0;
  }

  return {
    rocks,
    checkShipCollisions,
    reset,
  };
}
