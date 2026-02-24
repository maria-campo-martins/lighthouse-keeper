// rocks.js
import * as THREE from "three";

// ---------- helpers ----------
function randRange(min, max) {
  return min + Math.random() * (max - min);
}

// Adds subtle “wet near waterline” shading while staying MeshStandardMaterial.
// This is one of the highest-impact realism upgrades for rocks near water.
function applyWetnessPatch(mat, { oceanY = 0, wetHeight = 6.0, wetDarken = 0.35, wetRoughMult = 0.55 } = {}) {
  mat.onBeforeCompile = (shader) => {
    shader.uniforms.uWaterY = { value: oceanY };
    shader.uniforms.uWetHeight = { value: wetHeight };
    shader.uniforms.uWetDarken = { value: wetDarken };
    shader.uniforms.uWetRoughMult = { value: wetRoughMult };

    // vertex: pass world Y
    shader.vertexShader = shader.vertexShader
      .replace(
        "#include <common>",
        `
        #include <common>
        varying float vWorldY;
        `
      )
      .replace(
        "#include <begin_vertex>",
        `
        #include <begin_vertex>
        vec4 wp = modelMatrix * vec4(position, 1.0);
        vWorldY = wp.y;
        `
      );

    // fragment: darken + reduce roughness near the waterline
    shader.fragmentShader = shader.fragmentShader
      .replace(
        "#include <common>",
        `
        #include <common>
        varying float vWorldY;
        uniform float uWaterY;
        uniform float uWetHeight;
        uniform float uWetDarken;
        uniform float uWetRoughMult;
        `
      )
      .replace(
        "#include <roughnessmap_fragment>",
        `
        #include <roughnessmap_fragment>

        float wet = 1.0 - smoothstep(uWaterY, uWaterY + uWetHeight, vWorldY);
        diffuseColor.rgb *= mix(1.0, 1.0 - uWetDarken, wet);
        roughnessFactor *= mix(1.0, uWetRoughMult, wet);
        `
      );

    mat.userData.shader = shader;
  };

  mat.needsUpdate = true;
}

// Make rocks feel less like perfect low-poly blobs:
// - slight extra subdivision (detail=1)
// - vertex noise
// - Standard material (lit + fog + tonemapping)
// - optional wetness near ocean
function makeRockMesh({
  radius = 6,
  oceanY = 0,
  envMap = null,
  enableWetness = true,
} = {}) {
  // Slightly higher detail than 0 gives better shading with little cost
  const geo = new THREE.IcosahedronGeometry(radius, 1);

  // Vertex noise: breaks perfect symmetry (cheap realism)
  const pos = geo.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    const y = pos.getY(i);
    const z = pos.getZ(i);

    // Noise proportional-ish to rock size
    const n = randRange(-0.12, 0.12) * radius; // tweak 0.08–0.18
    pos.setXYZ(i, x + n, y + n * 0.6, z + n);
  }
  pos.needsUpdate = true;
  geo.computeVertexNormals();

  const mat = new THREE.MeshStandardMaterial({
    // Slight cool tint so rocks inherit the ocean/sky palette better
    color: new THREE.Color(0x2f3a46),
    roughness: 0.9,
    metalness: 0.0,

    // If you have an environment map (HDRI/PMREM), this helps rocks match the ocean’s reflections
    envMap: envMap ?? null,
    envMapIntensity: envMap ? 0.6 : 0.0,
  });

  if (enableWetness) {
    applyWetnessPatch(mat, {
      oceanY,
      wetHeight: Math.max(4.0, radius * 0.55), // scales a bit with rock size
      wetDarken: 0.40,
      wetRoughMult: 0.50,
    });
  }

  const mesh = new THREE.Mesh(geo, mat);
  mesh.castShadow = false;
  mesh.receiveShadow = true;

  // Squash/scale so they aren’t spheres
  mesh.scale.set(randRange(0.85, 1.5), randRange(0.55, 1.05), randRange(0.85, 1.5));
  mesh.rotation.set(randRange(0, Math.PI), randRange(0, Math.PI), randRange(0, Math.PI));

  return mesh;
}

function getShipApproxSphere(shipMesh, outSphere) {
  const box = new THREE.Box3().setFromObject(shipMesh);
  box.getBoundingSphere(outSphere);
  return outSphere;
}

// ---------- public API ----------
export function createRockSystem(
  scene,
  {
    count = 8,

    // Placement region (world space)
    xMin = -200,
    xMax = 200,
    zMin = 120,
    zMax = 520,

    // Ocean height (your ocean plane is y=0)
    oceanY = 0,

    // Optional: pass scene.environment (PMREM/HDR) for better integration
    envMap = null,

    // Rock sizing
    rockRadiusMin = 5,
    rockRadiusMax = 14,

    // Spacing between rocks
    minSpacing = 20,

    // Visual tuning
    enableWetness = true,
  } = {}
) {
  const rocks = [];

  function addRockAt(x, z, radius) {
    const mesh = makeRockMesh({
      radius,
      oceanY,
      envMap,
      enableWetness,
    });

    // Slightly above water; wetness shader handles the base dark/shiny look
    mesh.position.set(x, oceanY + radius * 0.20, z);

    // Collider sphere (static)
    const collider = {
      center: new THREE.Vector3(x, oceanY + radius * 0.20, z),
      radius: radius * 0.9,
    };

    rocks.push({ mesh, collider });
    scene.add(mesh);
  }

  function isFarEnough(x, z) {
    for (const r of rocks) {
      const dx = x - r.collider.center.x;
      const dz = z - r.collider.center.z;
      const d2 = dx * dx + dz * dz;
      const minD = minSpacing + r.collider.radius;
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
  const _shipSphere = new THREE.Sphere(new THREE.Vector3(), 1);

  function checkShipCollisions(
    ships,
    {
      markCrashed = true,
      hideOnCrash = true,
    } = {}
  ) {
    const hits = [];

    for (let si = 0; si < ships.length; si++) {
      const ship = ships[si];
      if (!ship || !ship.mesh) continue;

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