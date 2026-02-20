import * as THREE from "three";

function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }

export function createLighthouseBeam(scene, camera, CONFIG) {
  const _coneOrigin = new THREE.Vector3();
  const _coneDir = new THREE.Vector3();
  const _zAxis = new THREE.Vector3(0, 0, 1);
  const _tmpQuat = new THREE.Quaternion();
  // Add these temps near the top of createLighthouseBeam
    const _spotCenter = new THREE.Vector3();

    function getSpotCenterOnPlane(planeY = 0.6) {
    // Tip and dir in world (you already compute these in getCone)
    beamGroup.getWorldPosition(_coneOrigin);

    beamGroup.getWorldQuaternion(_tmpQuat);
    _coneDir.copy(_zAxis).applyQuaternion(_tmpQuat).normalize();

    const dy = _coneDir.y;
    if (Math.abs(dy) < 1e-4) return null; // nearly parallel to plane => no stable intersection

    const t = (planeY - _coneOrigin.y) / dy;
    if (t <= 0) return null; // intersection behind the lamp

    // optional: require it to be within beam length
    if (t > CONFIG.beamLength) return null;

    _spotCenter.copy(_coneOrigin).addScaledVector(_coneDir, t);
    return _spotCenter.clone();
    }

  // Initialize rotation with configurable initial values
  const beamRotation = { 
    yaw: CONFIG.beamInitialYaw ?? 0, 
    pitch: CONFIG.beamInitialPitch ?? 0 
  };
  const keysPressed = { ArrowLeft: false, ArrowRight: false, ArrowUp: false, ArrowDown: false };

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
    opacity: 0.0,
    side: THREE.DoubleSide,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  });

  const beamMesh = new THREE.Mesh(beamGeometry, beamMaterial);

  // Rotate cone 90° around X-axis so it points forward (+Z in group space)
  beamMesh.rotation.x = -Math.PI / 2;

  // Tip at group origin; base at z=beamLength
  beamMesh.position.z = CONFIG.beamLength / 2;

  const beamGroup = new THREE.Group();
  beamGroup.add(beamMesh);

  camera.add(beamGroup);
  scene.add(camera);

  const z = (CONFIG.lampOffsetZ ?? -2.5);
  beamGroup.position.set(
    CONFIG.lampOffsetX ?? 0,
    CONFIG.lampOffsetY ?? 0,
    (z === 0 ? -2.5 : z)
  );

  // Spot light (visual only; does not affect getCone)
  const beamLight = new THREE.SpotLight(
    CONFIG.beamColor,
    2,
    CONFIG.beamLength,
    Math.PI / 6,
    0.3
  );
  beamLight.position.set(0, 0, 0);
  beamGroup.add(beamLight);

  beamLight.target.position.set(0, 0, CONFIG.beamLength);
  beamGroup.add(beamLight.target);

  beamGroup.rotation.order = "YXZ";
  beamGroup.rotation.y = beamRotation.yaw;
  beamGroup.rotation.x = beamRotation.pitch;

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
    const initialYaw = CONFIG.beamInitialYaw ?? 0;
    const initialPitch = CONFIG.beamInitialPitch ?? 0;
    beamRotation.yaw = initialYaw;
    beamRotation.pitch = initialPitch;

    beamGroup.rotation.order = "YXZ";
    beamGroup.rotation.y = initialYaw;
    beamGroup.rotation.x = initialPitch;
    beamGroup.rotation.z = 0;
  }

  function update() {
    if (!enabled) return;

    if (keysPressed.ArrowLeft)  beamRotation.yaw += CONFIG.beamRotationSpeed;
    if (keysPressed.ArrowRight) beamRotation.yaw -= CONFIG.beamRotationSpeed;

    const maxPitch = Math.PI / 3;
    if (keysPressed.ArrowUp) {
      beamRotation.pitch = clamp(beamRotation.pitch - CONFIG.beamRotationSpeed, -maxPitch, maxPitch);
    }
    if (keysPressed.ArrowDown) {
      beamRotation.pitch = clamp(beamRotation.pitch + CONFIG.beamRotationSpeed, -maxPitch, maxPitch);
    }

    beamGroup.rotation.order = "YXZ";
    beamGroup.rotation.y = beamRotation.yaw;
    beamGroup.rotation.x = beamRotation.pitch;
  }

  // OLD behavior: use visual cone geometry half-angle
  function getCone() {
    beamGroup.getWorldPosition(_coneOrigin);

    beamGroup.getWorldQuaternion(_tmpQuat);
    _coneDir.copy(_zAxis).applyQuaternion(_tmpQuat).normalize();

    const angle = Math.atan(CONFIG.beamRadius / CONFIG.beamLength);

    return {
      origin: _coneOrigin.clone(),
      dir: _coneDir.clone(),
      angle,
      length: CONFIG.beamLength,
    };
  }

  return { update, setEnabled, setOpacityForProgress, resetAim, getCone, getSpotCenterOnPlane };
}