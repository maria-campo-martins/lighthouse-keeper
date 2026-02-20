import * as THREE from "three";

function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }

export function createLighthouseBeam(scene, camera, CONFIG) {
  const beamRotation = { yaw: 0, pitch: 0 };
  const keysPressed = { ArrowLeft: false, ArrowRight: false, ArrowUp: false, ArrowDown: false };

  // --- Geometry: cone points along +Y by default ---
  // We want: apex at pivot, beam extends forward into camera (-Z).
  const beamGeometry = new THREE.ConeGeometry(
    CONFIG.beamRadius,
    CONFIG.beamLength,
    CONFIG.beamSegments,
    1,
    true
  );

  // Move geometry so TIP (apex) is at local origin.
  // Default cone tip is at y=+h/2, base at y=-h/2.
  // Translating down by h/2 makes tip at y=0 and base at y=-h.
  beamGeometry.translate(0, -CONFIG.beamLength / 2, 0);

  const beamMaterial = new THREE.MeshBasicMaterial({
    color: CONFIG.beamColor,
    transparent: true,
    opacity: 0.0,                 // start invisible
    side: THREE.FrontSide,        // don't show inside walls
    depthWrite: false,
    blending: THREE.AdditiveBlending, // looks more "lighty"
  });

  const beamMesh = new THREE.Mesh(beamGeometry, beamMaterial);

  // Rotate so local -Y (the direction from tip to base after translate)
  // points to camera forward (-Z). This is the key orientation.
  beamMesh.rotation.x = -Math.PI / 2;

  const beamGroup = new THREE.Group();
  beamGroup.add(beamMesh);

  // Attach to camera: inherits camera position + rotation automatically
  camera.add(beamGroup);
  scene.add(camera);

  // Place the lamp slightly in front of camera, in camera-local space.
  // camera forward is -Z so lampOffsetZ must be negative.
  const z = (CONFIG.lampOffsetZ ?? -2.5);
  beamGroup.position.set(
    CONFIG.lampOffsetX ?? 0,
    CONFIG.lampOffsetY ?? 0,
    (z === 0 ? -2.5 : z)
  );

  // Optional spot light to sell the effect (targets forward -Z)
  const beamLight = new THREE.SpotLight(
    CONFIG.beamColor,
    2,
    CONFIG.beamLength,
    Math.PI / 6,
    0.3
  );
  beamGroup.add(beamLight);

  beamLight.target.position.set(0, 0, -CONFIG.beamLength);
  beamGroup.add(beamLight.target);

  // Visibility control (prevents intro rendering)
  let enabled = false;
  beamGroup.visible = false;

  function onKeyDown(e) {
    if (!enabled) return;
    if (e.key in keysPressed) { keysPressed[e.key] = true; e.preventDefault(); }
  }
  function onKeyUp(e) {
    if (e.key in keysPressed) { keysPressed[e.key] = false; e.preventDefault(); }
  }
  window.addEventListener("keydown", onKeyDown);
  window.addEventListener("keyup", onKeyUp);

  function setEnabled(v) {
    enabled = v;
    beamGroup.visible = v;
    if (!v) beamMaterial.opacity = 0.0;
  }

  function setOpacityForProgress(progress) {
    if (!enabled) { beamMaterial.opacity = 0.0; return; }
    const op = 0.35 + 0.25 * progress;
    beamMaterial.opacity = Math.min(op, 0.6);
  }

  function resetAim() {
    beamRotation.yaw = 0;
    beamRotation.pitch = 0;
    beamGroup.rotation.set(0, 0, 0);
  }

  function update() {
    if (!enabled) return;

    if (keysPressed.ArrowLeft) beamRotation.yaw += CONFIG.beamRotationSpeed;
    if (keysPressed.ArrowRight) beamRotation.yaw -= CONFIG.beamRotationSpeed;

    const maxPitch = Math.PI / 3;
    if (keysPressed.ArrowUp)   beamRotation.pitch = clamp(beamRotation.pitch - CONFIG.beamRotationSpeed, -maxPitch, maxPitch);
    if (keysPressed.ArrowDown) beamRotation.pitch = clamp(beamRotation.pitch + CONFIG.beamRotationSpeed, -maxPitch, maxPitch);

    // Local offsets from the camera's direction
    beamGroup.rotation.order = "YXZ";
    beamGroup.rotation.y = beamRotation.yaw;
    beamGroup.rotation.x = beamRotation.pitch;
  }

  return { update, setEnabled, setOpacityForProgress, resetAim };
}