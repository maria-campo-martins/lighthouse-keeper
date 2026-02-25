// sky.js
import * as THREE from "three";

export function createSkyDome(scene, renderer, CONFIG) {
  const uniforms = {
    uDawn: { value: 0 },
    uSkyNight: { value: new THREE.Color(CONFIG.skyColorNight) },
    uSkyDawn: { value: new THREE.Color(CONFIG.skyColorDawn) },

    // IMPORTANT: we will store this in VIEW SPACE (set in update()).
    uLightDir: { value: new THREE.Vector3(0.3, 1.0, 0.2).normalize() },

    uBrightness: { value: 1.0 },
  };

  const vertexShader = /* glsl */ `
    varying vec3 vDir;
    void main() {
      // keep it centered on camera
      vec4 mvPos = modelViewMatrix * vec4(position, 1.0);
      vDir = normalize(mvPos.xyz); // view-space direction
      gl_Position = projectionMatrix * mvPos;
    }
  `;

  const fragmentShader = /* glsl */ `
    precision mediump float;

    uniform float uDawn;
    uniform vec3 uSkyNight;
    uniform vec3 uSkyDawn;
    uniform vec3 uLightDir;     // view-space
    uniform float uBrightness;

    varying vec3 vDir;

    // Small hash / noise helpers (no textures)
    float hash12(vec2 p) {
      // cheap-ish, stable hash
      vec3 p3 = fract(vec3(p.xyx) * 0.1031);
      p3 += dot(p3, p3.yzx + 33.33);
      return fract((p3.x + p3.y) * p3.z);
    }

    // Stars based on direction -> spherical coordinates
    float starField(vec3 dir) {
      // map direction to pseudo-UV on a sphere
      float u = atan(dir.z, dir.x) / 6.2831853 + 0.5;
      float v = asin(clamp(dir.y, -1.0, 1.0)) / 3.1415926 + 0.5;
      vec2 uv = vec2(u, v);

      // higher frequency grid -> sparse bright points
      vec2 gv = fract(uv * 600.0);
      vec2 id = floor(uv * 600.0);

      float rnd = hash12(id);
      // star density control
      float star = step(0.9975, rnd); // ~0.25% of cells
      // soften within the cell (bright center)
      float d = length(gv - 0.5);
      float falloff = smoothstep(0.10, 0.0, d);

      // vary brightness a bit
      float twinkle = 0.6 + 0.4 * hash12(id + 17.0);

      return star * falloff * twinkle;
    }

    void main() {
      vec3 dir = normalize(vDir);

      // vertical blend: horizon (dir.y ~ 0) -> zenith (dir.y ~ 1)
      float t = clamp(dir.y * 0.5 + 0.5, 0.0, 1.0);

      // base color between night and dawn
      vec3 base = mix(uSkyNight, uSkyDawn, uDawn);

      // simple "real sky" gradient: darker at top, lighter near horizon
      vec3 zenith  = base * 0.55;
      vec3 horizon = base * 1.35;

      // mix horizon->zenith
      vec3 col = mix(horizon, zenith, smoothstep(0.0, 1.0, t));

      // haze band near horizon (keeps it from going black)
      float haze = exp(-pow(t / 0.18, 2.0));
      col += vec3(0.08, 0.10, 0.14) * haze * (1.0 - 0.6 * uDawn);

      // --- Sun disk + halo (view-space light dir) ---
      vec3 L = normalize(uLightDir);
      float mu = clamp(dot(dir, L), 0.0, 1.0);

      // tiny sun disk (sharp)
      float sunDisk = smoothstep(0.9995, 1.0, mu);

      // soft halo / forward scattering (wide)
      float sunHalo = pow(mu, 64.0) * 0.6 + pow(mu, 256.0) * 0.8;

      // warm-ish scattering tint near sun, stronger at dawn
      vec3 sunTint = mix(vec3(0.9, 0.95, 1.0), vec3(1.05, 0.75, 0.55), clamp(uDawn, 0.0, 1.0));
      float sunStrength = mix(0.25, 1.25, uDawn);

      col += sunTint * (sunHalo * sunStrength);
      col += sunTint * sunDisk * (0.75 + 0.75 * uDawn);

      // subtle “sky brightening” around sun even at night (moon-ish feel)
      col += vec3(0.05, 0.06, 0.08) * pow(mu, 32.0) * (1.0 - 0.7 * uDawn);

      // --- Stars (fade out as dawn increases) ---
      float stars = starField(dir);
      float starVis = smoothstep(0.45, 0.0, uDawn); // visible at night, gone by dawn
      // keep stars out of the hazy horizon band
      float horizonMask = smoothstep(0.10, 0.35, t);
      col += vec3(1.0) * stars * starVis * horizonMask * 0.9;

      // --- Tiny dithering to reduce banding ---
      float dither = (hash12(gl_FragCoord.xy) - 0.5) / 255.0;
      col += dither;

      col *= uBrightness;

      gl_FragColor = vec4(col, 1.0);
    }
  `;

  const mat = new THREE.ShaderMaterial({
    uniforms,
    vertexShader,
    fragmentShader,
    side: THREE.BackSide,
    depthTest: false,
    depthWrite: false,
  });

  const R = (CONFIG.cameraFar ?? 2000) * 0.95; // must be < camera.far
  const mesh = new THREE.Mesh(new THREE.SphereGeometry(R, 48, 24), mat);
  mesh.name = "SkyDome";
  mesh.frustumCulled = false;
  mesh.renderOrder = -999;

  scene.add(mesh);

  function setActive(active) {
    mesh.visible = active;
    if (active) {
      scene.background = null; // IMPORTANT: don't use scene.background anymore
    }
  }

  function setDawn(progress) {
    mat.uniforms.uDawn.value = progress;
  }

  function setColors({ night, dawn } = {}) {
    if (night !== undefined) mat.uniforms.uSkyNight.value.set(night);
    if (dawn !== undefined) mat.uniforms.uSkyDawn.value.set(dawn);
  }

  function setBrightness(b) {
    mat.uniforms.uBrightness.value = b;
  }

  // temp to avoid per-frame allocations
  const tmpLightView = new THREE.Vector3();

  // call every frame
  function update(camera, lightDirWorld /* THREE.Vector3 */) {
    mesh.position.copy(camera.position);

    if (lightDirWorld) {
      // Convert WORLD direction -> VIEW direction so it matches vDir space
      tmpLightView.copy(lightDirWorld).normalize();
      tmpLightView.transformDirection(camera.matrixWorldInverse);
      mat.uniforms.uLightDir.value.copy(tmpLightView).normalize();
    }
  }

  return { mesh, mat, setActive, setDawn, setColors, setBrightness, update };
}