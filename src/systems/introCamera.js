import * as THREE from "three";

function clamp01(x) { return Math.max(0, Math.min(1, x)); }
function smoothstep(t) { return t * t * (3 - 2 * t); }

export function createIntroCamera(camera, opts) {
  const {
    duration = 6.0,
    startPos,
    startLook,
    endPos,
    endLook,
    // optional: allow overriding midpoints; otherwise auto-compute
    midPos: midPosOverride = null,
    midLook: midLookOverride = null,
  } = opts;

  // Auto midpoints if not provided
  const midPos = midPosOverride
    ? midPosOverride.clone()
    : startPos.clone().lerp(endPos, 0.55).add(new THREE.Vector3(0, 120, 0));

  const midLook = midLookOverride
    ? midLookOverride.clone()
    : startLook.clone().lerp(endLook, 0.55);

  const tmpLook = new THREE.Vector3();
  let startTime = null;

  function reset(now) { startTime = now; }

  function update(now) {
    if (startTime === null) startTime = now;

    const t = clamp01((now - startTime) / duration);
    const e = smoothstep(t);

    if (e < 0.7) {
      const u = smoothstep(e / 0.7);
      camera.position.lerpVectors(startPos, midPos, u);
      tmpLook.lerpVectors(startLook, midLook, u);
      camera.lookAt(tmpLook);
    } else {
      const u = smoothstep((e - 0.7) / 0.3);
      camera.position.lerpVectors(midPos, endPos, u);
      tmpLook.lerpVectors(midLook, endLook, u);
      camera.lookAt(tmpLook);
    }

    return t >= 1;
  }

  return { update, reset };
}