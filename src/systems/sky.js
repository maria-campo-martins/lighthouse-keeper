// sky.js
import * as THREE from "three";

export function createSkyDome(scene, renderer, CONFIG) {
  const uniforms = {
    uTime: { value: 0 },
    uDawn: { value: 0 },
    uSkyNight: { value: new THREE.Color(CONFIG.skyColorNight) },
    uSkyDawn: { value: new THREE.Color(CONFIG.skyColorDawn) },

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

    uniform float uTime;
    uniform float uDawn;
    uniform vec3 uSkyNight;
    uniform vec3 uSkyDawn;
    uniform vec3 uLightDir;
    uniform float uBrightness;

    varying vec3 vDir;

    float hash12(vec2 p) {
      vec3 p3 = fract(vec3(p.xyx) * 0.1031);
      p3 += dot(p3, p3.yzx + 33.33);
      return fract((p3.x + p3.y) * p3.z);
    }

    float noise(vec2 p) {
      vec2 i = floor(p);
      vec2 f = fract(p);

      float a = hash12(i);
      float b = hash12(i + vec2(1.0, 0.0));
      float c = hash12(i + vec2(0.0, 1.0));
      float d = hash12(i + vec2(1.0, 1.0));

      vec2 u = f * f * (3.0 - 2.0 * f);

      return mix(a, b, u.x) +
             (c - a) * u.y * (1.0 - u.x) +
             (d - b) * u.x * u.y;
    }

    float fbm(vec2 p) {
      float v = 0.0;
      float a = 0.5;
      for (int i = 0; i < 5; i++) {
        v += a * noise(p);
        p *= 2.0;
        a *= 0.5;
      }
      return v;
    }

    float starField(vec3 dir) {
      float u = atan(dir.z, dir.x) / 6.2831853 + 0.5;
      float v = asin(clamp(dir.y, -1.0, 1.0)) / 3.1415926 + 0.5;
      vec2 uv = vec2(u, v);

      vec2 gv = fract(uv * 600.0);
      vec2 id = floor(uv * 600.0);

      float rnd = hash12(id);
      float star = step(0.9975, rnd);
      float d = length(gv - 0.5);
      float falloff = smoothstep(0.10, 0.0, d);
      float twinkle = 0.6 + 0.4 * hash12(id + 17.0);

      return star * falloff * twinkle;
    }

    void main() {
      vec3 dir = normalize(vDir);
      float t = clamp(dir.y * 0.5 + 0.5, 0.0, 1.0);

      vec3 base = mix(uSkyNight, uSkyDawn, uDawn);

      vec3 zenith  = base * 0.55;
      vec3 horizon = base * 1.35;
      vec3 col = mix(horizon, zenith, smoothstep(0.0, 1.0, t));

      float haze = exp(-pow(t / 0.18, 2.0));
      col += vec3(0.08, 0.10, 0.14) * haze * (1.0 - 0.6 * uDawn);

      vec3 L = normalize(uLightDir);
      float mu = clamp(dot(dir, L), 0.0, 1.0);

      float sunDisk = smoothstep(0.9995, 1.0, mu);
      float sunHalo = pow(mu, 64.0) * 0.6 + pow(mu, 256.0) * 0.8;

      vec3 sunTint = mix(vec3(0.9, 0.95, 1.0), vec3(1.05, 0.75, 0.55), clamp(uDawn, 0.0, 1.0));
      float sunStrength = mix(0.25, 1.25, uDawn);

      col += sunTint * (sunHalo * sunStrength);
      col += sunTint * sunDisk * (0.75 + 0.75 * uDawn);
      col += vec3(0.05, 0.06, 0.08) * pow(mu, 32.0) * (1.0 - 0.7 * uDawn);

      // spherical UVs for clouds / stars
      float su = atan(dir.z, dir.x) / 6.2831853 + 0.5;
      float sv = asin(clamp(dir.y, -1.0, 1.0)) / 3.1415926 + 0.5;
      vec2 skyUV = vec2(su, sv);

      // ----- animated clouds -----
      // very slow drift in two different directions
      vec2 drift1 = vec2( 0.0025,  0.0007) * uTime;
      vec2 drift2 = vec2(-0.0012,  0.0004) * uTime;

      // domain warp to avoid obvious sliding
      vec2 warpUV = skyUV * vec2(2.0, 1.0) + vec2(0.0008, -0.0005) * uTime;
      vec2 warp = vec2(
        fbm(warpUV + vec2(3.1, 7.2)),
        fbm(warpUV + vec2(8.4, 1.9))
      );
      warp = (warp - 0.5) * 0.08;

      // big cloud masses
      vec2 cloudUV1 = (skyUV + warp) * vec2(3.0, 1.35) + drift1;

      // smaller breakup/detail
      vec2 cloudUV2 = (skyUV + warp * 1.4) * vec2(5.4, 2.2) + drift2;

      // slowly evolving shape so clouds are not completely rigid
      float baseCloud   = fbm(cloudUV1 + 0.03 * vec2(sin(uTime * 0.03), cos(uTime * 0.025)));
      float detailCloud = fbm(cloudUV2 + 0.02 * vec2(cos(uTime * 0.021), sin(uTime * 0.018)));

      float cloudNoise = baseCloud * 0.78 + detailCloud * 0.22;

      // mostly upper/mid sky
      float cloudHeightMask = smoothstep(0.20, 0.58, t);

      // threshold for patchy cloud coverage
      float clouds = smoothstep(0.57, 0.77, cloudNoise) * cloudHeightMask;

      // soften edges a bit
      clouds *= 0.88 + 0.12 * detailCloud;

      vec3 cloudNight = vec3(0.10, 0.12, 0.18);
      vec3 cloudDawn  = vec3(0.95, 0.68, 0.52);
      vec3 cloudTint  = mix(cloudNight, cloudDawn, uDawn);

      // silver lining near sun
      float silver = pow(mu, 10.0) * 0.45;
      vec3 finalCloud = cloudTint + sunTint * silver;

      // blend into sky
      col = mix(col, finalCloud, clouds * (0.22 + 0.30 * uDawn));

      float stars = starField(dir);
      float starVis = smoothstep(0.45, 0.0, uDawn);
      float horizonMask = smoothstep(0.10, 0.35, t);

      // stars hidden behind clouds
      stars *= (1.0 - clouds * 0.9);

      col += vec3(1.0) * stars * starVis * horizonMask * 0.9;

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
  function update(camera, lightDirWorld, elapsedTime = 0) {
    mesh.position.copy(camera.position);
    mat.uniforms.uTime.value = elapsedTime;

    if (lightDirWorld) {
      // Convert WORLD direction -> VIEW direction so it matches vDir space
      tmpLightView.copy(lightDirWorld).normalize();
      tmpLightView.transformDirection(camera.matrixWorldInverse);
      mat.uniforms.uLightDir.value.copy(tmpLightView).normalize();
    }
  }

  return { mesh, mat, setActive, setDawn, setColors, setBrightness, update };
}