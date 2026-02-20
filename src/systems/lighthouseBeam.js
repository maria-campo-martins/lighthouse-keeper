import * as THREE from "three";

function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }

export function createLighthouseBeam(scene, camera, CONFIG) {
  // Initialize rotation with configurable initial values
  const beamRotation = { 
    yaw: CONFIG.beamInitialYaw ?? 0, 
    pitch: CONFIG.beamInitialPitch ?? 0 
  };
  const keysPressed = { ArrowLeft: false, ArrowRight: false, ArrowUp: false, ArrowDown: false };

  // --- Geometry: cone points along +Y by default ---
  // Default cone: tip at y=+h/2, base at y=-h/2
  // We keep geometry in default position and position the mesh instead
  const beamGeometry = new THREE.ConeGeometry(
    CONFIG.beamRadius,
    CONFIG.beamLength,
    CONFIG.beamSegments,
    1,
    true
  );

  const beamMaterial = new THREE.MeshBasicMaterial({
    color: CONFIG.beamColor,
    transparent: true,
    opacity: 0.0,                 // start invisible
    side: THREE.DoubleSide,        // show both sides so circular end is visible
    depthWrite: false,
    blending: THREE.AdditiveBlending, // looks more "lighty"
  });

  const beamMesh = new THREE.Mesh(beamGeometry, beamMaterial);

  // Rotate cone 90° around X-axis so it points forward
  // Default cone: tip at +Y, base at -Y
  // After rotation: tip points along +Z, base extends along -Z
  beamMesh.rotation.x = -Math.PI / 2;
  
  // Position mesh so tip is at beamGroup origin and base extends forward
  // By positioning at beamLength/2, the cone tip aligns with beamGroup origin (z=0)
  // and the circular base extends forward to z=beamLength, making it visible
  beamMesh.position.z = CONFIG.beamLength / 2;

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

  // Spot light to illuminate objects in the scene
  // Positioned at beamGroup origin (where cone tip is)
  const beamLight = new THREE.SpotLight(
    CONFIG.beamColor,
    2,
    CONFIG.beamLength,
    Math.PI / 6,
    0.3
  );
  beamLight.position.set(0, 0, 0);
  beamGroup.add(beamLight);

  // Target positioned at the end of the beam (where circular base is)
  beamLight.target.position.set(0, 0, CONFIG.beamLength);
  beamGroup.add(beamLight.target);

  // Initialize beam rotation to configured initial values
  beamGroup.rotation.order = "YXZ";
  beamGroup.rotation.y = beamRotation.yaw;
  beamGroup.rotation.x = beamRotation.pitch;

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
    // Reset to initial configured rotation values
    const initialYaw = CONFIG.beamInitialYaw ?? 0;
    const initialPitch = CONFIG.beamInitialPitch ?? 0;
    beamRotation.yaw = initialYaw;
    beamRotation.pitch = initialPitch;
    
    // Apply initial rotation to the beam group
    beamGroup.rotation.order = "YXZ";
    beamGroup.rotation.y = initialYaw;
    beamGroup.rotation.x = initialPitch;
    beamGroup.rotation.z = 0;
  }

  function update() {
    if (!enabled) return;

    if (keysPressed.ArrowLeft){
    beamRotation.yaw += CONFIG.beamRotationSpeed;
    console.log(" yaw is ", beamRotation.yaw);
    }
    if (keysPressed.ArrowRight) {
      beamRotation.yaw -= CONFIG.beamRotationSpeed;
      console.log(" yaw is ", beamRotation.yaw);
    }

    const maxPitch = Math.PI / 3;
    if (keysPressed.ArrowUp) {
      beamRotation.pitch = clamp(beamRotation.pitch - CONFIG.beamRotationSpeed, -maxPitch, maxPitch);
      console.log(" pitch is ", beamRotation.pitch);
    }
    if (keysPressed.ArrowDown){
      beamRotation.pitch = clamp(beamRotation.pitch + CONFIG.beamRotationSpeed, -maxPitch, maxPitch);
      console.log(" pitch is ", beamRotation.pitch);
    }
    // Local offsets from the camera's direction
    beamGroup.rotation.order = "YXZ";
    beamGroup.rotation.y = beamRotation.yaw;
    beamGroup.rotation.x = beamRotation.pitch;
  }

  return { update, setEnabled, setOpacityForProgress, resetAim };
}