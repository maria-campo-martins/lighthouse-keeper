// oceanMaterial.js
import * as THREE from "three";

function makeOceanMaterial(CONFIG, normalTex, foamTex) {
    const uniforms = {
      uTime: { value: 0 },
      uDawn: { value: 0 },
  
      // colors (lerped in shader)
      uOceanNight: { value: new THREE.Color(CONFIG.oceanColorNight) },
      uOceanDawn: { value: new THREE.Color(CONFIG.oceanColorDawn) },
      uSkyNight: { value: new THREE.Color(CONFIG.skyColorNight) },
      uSkyDawn: { value: new THREE.Color(CONFIG.skyColorDawn) },
      uHorizonLift: { value: 0.1 },
      uHorizonLiftTint: { value: new THREE.Color(0xffffff) },
      uNoFresnel: { value: 0.0 }, 
  
      // lighting
      uLightDir: { value: new THREE.Vector3(0.3, 1.0, 0.2).normalize() },
      uLightColor: { value: new THREE.Color(0xffffff) },
  
      // waves
      uWaveAmp: { value: 0.65 },
      uWaveChop: { value: 1.15 },
      uWaveSpeed: { value: 0.7 },
      uWaveFreq: { value: 0.55 },
  
      // manual fog (ocean-only; scene fog can still be enabled separately)
      uFogColor: { value: new THREE.Color(CONFIG.fogColorNight) },
      uFogNear: { value: CONFIG.fogNear },
      uFogFar: { value: CONFIG.fogFar },
  
      // textures
      uNormalMap: { value: normalTex },
      uFoamMap: { value: foamTex },
  
      // texture tuning
      uNormalStrength: { value: 1.4 }, // try 0.7–1.4
      uFoamStrength: { value: 0.30 },  // try 0.0–0.6
      uTexScroll: { value: 0.03 },    // try 0.01–0.06
      uHorizonBoost: { value: .6 },   // try 0.4–1.6
    };
  
    const vertexShader = /* glsl */ `
      #include <common>
  
      uniform float uTime;
      uniform float uWaveAmp;
      uniform float uWaveChop;
      uniform float uWaveSpeed;
      uniform float uWaveFreq;
  
      varying vec3 vWorldPos;
      varying vec3 vWorldNormal;
      varying vec3 vViewDir;
      varying float vFogDepth;
  
      vec3 gerstner(vec2 xz, vec2 dir, float steep, float amp, float freq, float speed, out vec3 nAccum) {
        float t = uTime * speed * uWaveSpeed;
        float w = freq * uWaveFreq;
        float d = dot(dir, xz);
        float phase = w * d + t;
  
        float s = sin(phase);
        float c = cos(phase);
  
        float qa = steep * amp;
        vec3 disp;
        disp.x = dir.x * (qa * c) * uWaveChop;
        disp.y = amp * s;
        disp.z = dir.y * (qa * c) * uWaveChop;
  
        // Approx normal accumulation (good enough for water)
        nAccum += vec3(
          -dir.x * qa * w * s,
           1.0 - steep * w * amp * c,
          -dir.y * qa * w * s
        );
  
        return disp;
      }
  
      void main() {
        vec3 pos = position;
        vec2 xz = pos.xz;
  
        vec3 nAccum = vec3(0.0);
  
        vec2 d1 = normalize(vec2( 1.0,  0.2));
        vec2 d2 = normalize(vec2(-0.3,  1.0));
        vec2 d3 = normalize(vec2( 0.7, -0.9));
        vec2 d4 = normalize(vec2(-1.0, -0.4));
  
        float A = uWaveAmp;
  
        pos += gerstner(xz, d1, 0.90, 0.28*A, 0.55, 1.00, nAccum);
        pos += gerstner(xz, d2, 0.70, 0.22*A, 0.85, 0.80, nAccum);
        pos += gerstner(xz, d3, 0.55, 0.18*A, 1.25, 1.20, nAccum);
        pos += gerstner(xz, d4, 0.35, 0.14*A, 1.85, 1.50, nAccum);
  
        vec4 worldPos = modelMatrix * vec4(pos, 1.0);
        vWorldPos = worldPos.xyz;
  
        vec3 worldN = normalize((modelMatrix * vec4(normalize(nAccum), 0.0)).xyz);
        vWorldNormal = worldN;
  
        vViewDir = normalize(cameraPosition - vWorldPos);
  
        vec4 mvPosition = viewMatrix * worldPos;
        vFogDepth = -mvPosition.z;
  
        gl_Position = projectionMatrix * mvPosition;
      }
    `;
  
    const fragmentShader = /* glsl */ `
      #include <common>
  
      uniform float uTime;
      uniform float uDawn;
  
      uniform vec3 uOceanNight;
      uniform vec3 uOceanDawn;
      uniform vec3 uSkyNight;
      uniform vec3 uSkyDawn;
  
      uniform float uHorizonLift;
      uniform vec3 uHorizonLiftTint;
  
      uniform vec3 uLightDir;
      uniform vec3 uLightColor;
  
      uniform vec3 uFogColor;
      uniform float uFogNear;
      uniform float uFogFar;
  
      uniform sampler2D uNormalMap;
      uniform sampler2D uFoamMap;
      uniform float uNormalStrength;
      uniform float uFoamStrength;
      uniform float uTexScroll;
      uniform float uHorizonBoost;
      uniform float uNoFresnel;
  
      varying vec3 vWorldPos;
      varying vec3 vWorldNormal;
      varying vec3 vViewDir;
      varying float vFogDepth;
  
      void main() {
        vec3 oceanCol = mix(uOceanNight, uOceanDawn, uDawn);
        vec3 skyCol   = mix(uSkyNight,   uSkyDawn,   uDawn);
  
        vec3 V = normalize(vViewDir);
  
        // UVs from world XZ so it tiles nicely across the plane
        vec2 uv = vWorldPos.xz * 0.01;
  
        // Scroll two normal samples to reduce repetition
        vec2 uv1 = uv + vec2( 1.0,  0.2) * (uTime * uTexScroll);
        vec2 uv2 = uv + vec2(-0.3,  1.0) * (uTime * uTexScroll * 0.85);
  
        vec3 n1 = texture2D(uNormalMap, uv1).xyz * 2.0 - 1.0;
        vec3 n2 = texture2D(uNormalMap, uv2).xyz * 2.0 - 1.0;
        vec3 nTex = normalize(mix(n1, n2, 0.5));
  
        // Base wave normal (from vertex)
        vec3 N = normalize(vWorldNormal);
  
        // Blend ripples into normal
        vec3 N2 = normalize(N + vec3(nTex.x, 0.0, nTex.y) * uNormalStrength);
  
        float NoV = max(dot(N2, V), 0.0);
  
        float fresnel = (uNoFresnel > 0.5) ? 0.0 : pow(1.0 - NoV, 4.0);
        float horizon = (uNoFresnel > 0.5) ? 0.0 : pow(1.0 - NoV, 2.0) * uHorizonBoost;
  
        vec3 L = normalize(uLightDir);
        float ndl = max(dot(N2, L), 0.0);
  
        // Specular
        vec3 H = normalize(L + V);
        float specPow = mix(80.0, 220.0, fresnel);
        float spec = pow(max(dot(N2, H), 0.0), specPow);
  
        // Body color
        float lift = 0.65;
        float diffuse = (0.25 + 0.75 * ndl);
        vec3 base = oceanCol * (lift * diffuse + 0.10 * horizon);
  
        // Fake reflection (sky + horizon band)
        vec3 reflection = skyCol + vec3(0.25, 0.30, 0.40) * horizon;
  
        vec3 color = mix(base, reflection, clamp(fresnel + 0.15 * horizon, 0.0, 1.0));
        color += uLightColor * spec * (0.30 + 0.70 * fresnel);
  
        // Horizon lift (add AFTER color exists)
        float grazing = 1.0 - NoV;
        float horizonMask = smoothstep(0.35, 0.95, grazing);
        color += mix(skyCol, uHorizonLiftTint, 0.4) * (uHorizonLift * horizonMask);
  
        // Foam/noise breakup
        vec2 fuv = vWorldPos.xz * 0.004 + vec2(0.07, -0.03) * (uTime * uTexScroll * 2.2);
        float foamTex = texture2D(uFoamMap, fuv).r;
  
        float crest = 1.0 - clamp(N2.y, 0.0, 1.0);
        float foam = smoothstep(0.30, 0.75, crest) * foamTex * uFoamStrength;
        color = mix(color, vec3(1.0), foam * 0.12);
  
        // Manual fog (yours is basically off; keep it off if you want)
        float fogFactor = smoothstep(uFogNear, uFogFar, vFogDepth);
        fogFactor *= 0.000001;
        color = mix(color, uFogColor, fogFactor);
  
        gl_FragColor = vec4(color, 1.0);
      }
    `;
  
    return new THREE.ShaderMaterial({
      uniforms,
      vertexShader,
      fragmentShader,
      fog: false,
    });
}

export { makeOceanMaterial };
