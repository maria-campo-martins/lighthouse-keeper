import * as THREE from "three";

export function createPlayEnvironment(scene, renderer, CONFIG) {
  const root = new THREE.Group();
  root.name = "PlayEnvironment";
  scene.add(root);

  const _sky = new THREE.Color();
  const _ocean = new THREE.Color();
  const _fog = new THREE.Color();

  const fogRef = new THREE.Fog(CONFIG.fogColorNight, CONFIG.fogNear, CONFIG.fogFar);
  const bgNight = new THREE.Color(CONFIG.skyColorNight);

  const oceanGeo = new THREE.PlaneGeometry(
    CONFIG.oceanSize,
    CONFIG.oceanSize,
    CONFIG.oceanSegments,
    CONFIG.oceanSegments
  );

  const oceanMat = new THREE.MeshBasicMaterial({ color: CONFIG.oceanColorNight });
  const ocean = new THREE.Mesh(oceanGeo, oceanMat);
  ocean.rotation.x = -Math.PI / 2;
  ocean.position.y = 0;
  root.add(ocean);

  const ambient = new THREE.AmbientLight(CONFIG.ambientColor, CONFIG.ambientIntensity);
  root.add(ambient);

  // Start hidden until activated by main
  root.visible = false;

  function setActive(active) {
    root.visible = active;
    if (active) {
      scene.background = bgNight;
      scene.fog = fogRef;
    }
  }

  function applyDawn(progress) {
    if (!root.visible) return;

    _sky.lerpColors(
      new THREE.Color(CONFIG.skyColorNight),
      new THREE.Color(CONFIG.skyColorDawn),
      progress
    );
    scene.background.copy(_sky);

    _ocean.lerpColors(
      new THREE.Color(CONFIG.oceanColorNight),
      new THREE.Color(CONFIG.oceanColorDawn),
      progress
    );
    oceanMat.color.copy(_ocean);

    _fog.lerpColors(
      new THREE.Color(CONFIG.fogColorNight),
      new THREE.Color(CONFIG.fogColorDawn),
      progress
    );
    fogRef.color.copy(_fog);
  }

  return { root, setActive, applyDawn };
}
