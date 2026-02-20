import * as THREE from "three";
import { createLighthouse } from "./lighthouseModel.js";

/**
 * Intro environment = cliff/land + lighthouse + distant sea + moon lighting.
 * Returns a root group you can toggle on/off.
 */
export function createIntroEnvironment(scene, renderer, CONFIG) {
  const root = new THREE.Group();
  root.name = "IntroEnvironment";
  scene.add(root);

  // --- Intro sky/fog (night)
  const bgNight = new THREE.Color(0x0a1428);
  const fogNight = new THREE.Fog(0x080c18, 120, 1600);

  // --- Lighting (moonlight)
  const ambient = new THREE.AmbientLight(0x1a1a2e, 0.28);
  root.add(ambient);

  const moon = new THREE.DirectionalLight(0xbfdcff, 0.85);
  moon.position.set(-220, 320, 200);
  root.add(moon);

  // --- Cliff / land (simple stylized block + slope)
  const landMat = new THREE.MeshStandardMaterial({ color: 0x2b2b2b, roughness: 1.0 });

  const plateau = new THREE.Mesh(new THREE.BoxGeometry(260, 70, 240), landMat);
  plateau.position.set(0, 35, 0);
  root.add(plateau);

  // A sloped “face” toward the sea (just a stretched wedge)
  const slope = new THREE.Mesh(new THREE.BoxGeometry(260, 60, 180), landMat);
  slope.position.set(0, 25, -110);
  slope.rotation.x = -0.35;
  root.add(slope);

  // --- Distant ocean behind cliff
  const ocean = new THREE.Mesh(
    new THREE.PlaneGeometry(2400, 2400, 1, 1),
    new THREE.MeshStandardMaterial({ color: 0x06162d, roughness: 0.25, metalness: 0.05 })
  );
  ocean.rotation.x = -Math.PI / 2;
  ocean.position.set(0, 0, -1000);
  root.add(ocean);

  // --- Lighthouse (reuse your model module)
  const lighthouse = createLighthouse(renderer, CONFIG);
  const plateauTopY = 35 + 70 / 2;  
  lighthouse.group.position.set(0, plateauTopY + 0.05, 20);
  root.add(lighthouse.group);

  function setActive(active) {
    root.visible = active;
    if (active) {
      scene.background = bgNight;
      scene.fog = fogNight;
    }
  }

  return {
    root,
    setActive,
    lighthouse, 
    plateauTopY
  };
}