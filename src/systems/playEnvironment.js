// playEnvironment.js
import * as THREE from "three";
import { makeOceanMaterial } from "./oceanMaterial.js"; 

// Call once when you create the renderer (e.g. in main.js). Ensures ocean colors look correct.
export function configureRendererForOcean(renderer) {
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.NoToneMapping;
  renderer.toneMappingExposure = 1.0;
}


export function createPlayEnvironment(scene, renderer, CONFIG) {
  const root = new THREE.Group();
  root.name = "PlayEnvironment";
  scene.add(root);

  // --- scrolling sky dome (PLAY mode only) ---
  // Uses the same HDR equirectangular texture as scene.environment/background,
  // but scrolls it horizontally so the sky appears to pan around above the horizon.
  const skyUniforms = {
    uTime: { value: 0 },
    uTex: { value: null }, // assigned lazily from scene.environment
    uScrollSpeed: { value: 0.002 }, // texture revolutions per second (half previous speed)
    // Allow the scrolling dome to extend slightly below the horizon to cover HDR artifacts.
    // (Ocean will still render over it because it draws later with depth testing.)
    uHorizonCutoffY: { value: -0.2 },
  };

  const skyVertexShader = /* glsl */ `
    varying vec3 vDir;
    void main() {
      // Direction from center of dome (we keep it centered on the camera in update)
      vDir = normalize(position);
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `;

  const skyFragmentShader = /* glsl */ `
    precision mediump float;
    uniform sampler2D uTex;
    uniform float uTime;
    uniform float uScrollSpeed;
    uniform float uHorizonCutoffY;
    varying vec3 vDir;

    void main() {
      // Only render sky slightly below horizon; let ocean/scene handle the rest.
      if (vDir.y <= uHorizonCutoffY) {
        discard;
      }

      // Convert direction to equirectangular UVs matching THREE.EquirectangularReflectionMapping.
      vec3 dir = normalize(vDir);
      float PI = 3.14159265359;
      float u = atan(dir.z, dir.x) / (2.0 * PI) + 0.5;
      float v = asin(clamp(dir.y, -1.0, 1.0)) / PI + 0.5;

      // Scroll horizontally over time (wrap with fract).
      float scroll = uTime * uScrollSpeed;
      vec2 uv = vec2(fract(u + scroll), v);

      vec4 col = texture2D(uTex, uv);

      gl_FragColor = col;
    }
  `;

  const skyRadius = (CONFIG.cameraFar ?? 2000) * 0.95;
  const skyGeo = new THREE.SphereGeometry(skyRadius, 48, 24);
  const skyMat = new THREE.ShaderMaterial({
    uniforms: skyUniforms,
    vertexShader: skyVertexShader,
    fragmentShader: skyFragmentShader,
    side: THREE.BackSide,
    depthWrite: false,
    depthTest: false,
  });
  const skyMesh = new THREE.Mesh(skyGeo, skyMat);
  skyMesh.name = "PlayScrollingSky";
  skyMesh.frustumCulled = false;
  skyMesh.renderOrder = -1000; // draw before everything else (after clear/background)
  root.add(skyMesh);

  // --- textures ---
  const loader = new THREE.TextureLoader();

  const normalTex = loader.load(
    "/textures/water_normal.jpg",
    () => console.log("normal loaded"),
    undefined,
    (e) => console.error("normal failed", e)
  );  
  normalTex.wrapS = normalTex.wrapT = THREE.RepeatWrapping;
  normalTex.repeat.set(20, 20);
  normalTex.colorSpace = THREE.NoColorSpace;
  normalTex.anisotropy = renderer.capabilities.getMaxAnisotropy();

  const foamTex = loader.load(
    "/textures/foam_noise.png",
    () => console.log("foam loaded"),
    undefined,
    (e) => console.error("foam failed", e)
  );
  foamTex.wrapS = foamTex.wrapT = THREE.RepeatWrapping;
  foamTex.repeat.set(6, 6);
  foamTex.colorSpace = THREE.SRGBColorSpace;
  foamTex.anisotropy = renderer.capabilities.getMaxAnisotropy();

  // --- scene colors ---
  const _fog = new THREE.Color();

  // --- ocean mesh ---
  const oceanGeo = new THREE.PlaneGeometry(
    CONFIG.oceanSize,
    CONFIG.oceanSize,
    Math.max(CONFIG.oceanSegments ?? 128, 128),
    Math.max(CONFIG.oceanSegments ?? 128, 128)
  );

  const oceanMat = makeOceanMaterial(CONFIG, normalTex, foamTex);
  const ocean = new THREE.Mesh(oceanGeo, oceanMat);
  ocean.rotation.x = -Math.PI / 2;
  ocean.position.y = 0;
  root.add(ocean);

  // --- horizon curtain (covers HDR horizon smear) ---
  // A thin vertical plane at the far edge of the ocean that is colored like the ocean.
  // This "brings the ocean up" a bit at the horizon and visually hides the HDR band
  // without distorting the sky texture.
  const horizonUniforms = {
    uDawn: { value: 0 },
    uOceanNight: { value: new THREE.Color(CONFIG.oceanColorNight) },
    uOceanDawn: { value: new THREE.Color(CONFIG.oceanColorDawn) },
    uAlphaTop: { value: 0.0 },   // fade out at top edge
    uAlphaBottom: { value: 1.0 } // solid at horizon line
  };

  const horizonMat = new THREE.ShaderMaterial({
    uniforms: horizonUniforms,
    transparent: true,
    depthWrite: false,
    depthTest: true,
    side: THREE.DoubleSide,
    vertexShader: /* glsl */ `
      varying vec2 vUv;
      void main() {
        vUv = uv;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: /* glsl */ `
      precision mediump float;
      uniform float uDawn;
      uniform vec3 uOceanNight;
      uniform vec3 uOceanDawn;
      uniform float uAlphaTop;
      uniform float uAlphaBottom;
      varying vec2 vUv;

      void main() {
        vec3 oceanCol = mix(uOceanNight, uOceanDawn, uDawn);

        // Strongest at the horizon (bottom), fades out as it goes upward.
        float t = smoothstep(0.0, 1.0, vUv.y);
        float a = mix(uAlphaBottom, uAlphaTop, pow(t, 4.0));
        gl_FragColor = vec4(oceanCol, a);
      }
    `,
  });
  
  const curtainHeight = 160;
  const curtainRadius = (CONFIG.oceanSize * 0.5) - 10;
  const horizonCurtain = new THREE.Mesh(
    // Open-ended cylinder "ring" around the camera to cover the HDR horizon band in all directions.
    new THREE.CylinderGeometry(curtainRadius, curtainRadius, curtainHeight, 96, 1, true),
    horizonMat
  );
  horizonCurtain.name = "OceanHorizonCurtain";
  // Cylinder's height is centered on its origin; lift so bottom sits at y=0 (ocean surface).
  horizonCurtain.position.set(0, curtainHeight / 2, 0);
  horizonCurtain.renderOrder = -900; // after sky dome (-1000), before scene
  root.add(horizonCurtain);

  // --- lights (for the rest of the scene) ---
  const ambient = new THREE.AmbientLight(CONFIG.ambientColor, CONFIG.ambientIntensity);
  root.add(ambient);

  // Moon key light (main visibility for rocks)
  const moon = new THREE.DirectionalLight(0xbfd6ff, 1.1); // 0.8–1.6
  moon.position.set(200, 400, 100);
  root.add(moon);

  // Soft sky/ocean fill (makes shadows readable)
  const hemi = new THREE.HemisphereLight(
    CONFIG.skyColorNight,   // sky tint
    CONFIG.oceanColorNight, // ground/ocean bounce
    0.55                    // 0.25–0.8
  );
  root.add(hemi);

  // temp vector to avoid allocations
  const _tmp = new THREE.Vector3();

  // Start hidden until activated by main
  root.visible = false;

  function setActive(active) {
    root.visible = active;
    if (active) {
      scene.fog = null;
      // Lazily hook up the HDR sky texture once it's available.
      if (!skyUniforms.uTex.value && scene.environment && scene.environment.isTexture) {
        skyUniforms.uTex.value = scene.environment;
      }
      scene.background = null;
    }
  }

  function applyDawn(progress) {
    if (!root.visible) return;

    // keep your ocean blending
    _fog.lerpColors(
      new THREE.Color(CONFIG.fogColorNight),
      new THREE.Color(CONFIG.fogColorDawn),
      progress
    );

    oceanMat.uniforms.uDawn.value = progress;
    oceanMat.uniforms.uFogColor.value.copy(_fog);

    horizonUniforms.uDawn.value = progress;

    oceanMat.uniforms.uOceanNight.value.set(CONFIG.oceanColorNight);
    oceanMat.uniforms.uOceanDawn.value.set(CONFIG.oceanColorDawn);
    oceanMat.uniforms.uSkyNight.value.set(CONFIG.skyColorNight);
    oceanMat.uniforms.uSkyDawn.value.set(CONFIG.skyColorDawn);

    horizonUniforms.uOceanNight.value.set(CONFIG.oceanColorNight);
    horizonUniforms.uOceanDawn.value.set(CONFIG.oceanColorDawn);
  }

  // Call every frame from main animate loop
  function update(elapsedTimeSeconds, camera = null) {
    if (!root.visible) return;

    oceanMat.uniforms.uTime.value = elapsedTimeSeconds;
    skyUniforms.uTime.value = elapsedTimeSeconds;

    // Sync shader light dir to the DirectionalLight (so spec highlights make sense)
    _tmp.copy(moon.position).normalize().negate();
    oceanMat.uniforms.uLightDir.value.copy(_tmp);

    // Keep sky dome centered on the camera so it behaves like an infinite sky.
    if (camera) {
      skyMesh.position.copy(camera.position);

      // "Infinite ocean" trick:
      // Move the ocean + horizon curtain with the camera in XZ so you don't see the
      // fixed square plane edges when the camera position changes.
      //
      // Snap to a grid to reduce visible texture swimming in the ocean shader
      // (which uses world-space XZ for UVs).
      const snap = 50; // world units; tune 25–100
      const snappedX = Math.round(camera.position.x / snap) * snap;
      const snappedZ = Math.round(camera.position.z / snap) * snap;

      ocean.position.x = snappedX;
      ocean.position.z = snappedZ;

      horizonCurtain.position.x = snappedX;
      horizonCurtain.position.z = snappedZ;
    }
  }

  return { root, setActive, applyDawn, update };
}