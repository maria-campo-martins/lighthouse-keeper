import * as THREE from "three";

export function createLighthouse(renderer, CONFIG = {}) {

  function makeStripeTexture(stripes = 12) {
    const canvas = document.createElement("canvas");
    canvas.width = 256;
    canvas.height = 1024;

    const ctx = canvas.getContext("2d");
    const stripeHeight = canvas.height / stripes;

    for (let i = 0; i < stripes; i++) {
      ctx.fillStyle = (i % 2 === 0) ? "#ffffff" : "#d61f1f";
      ctx.fillRect(0, i * stripeHeight, canvas.width, stripeHeight);
    }

    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.anisotropy = renderer.capabilities.getMaxAnisotropy();

    return texture;
  }

  const group = new THREE.Group();
  group.name = "Lighthouse";

  const stripeTexture = makeStripeTexture(12);

  // Tower (slightly tapered)
  const towerHeight = 80;
  const tower = new THREE.Mesh(
    new THREE.CylinderGeometry(12, 14, towerHeight, 48),
    new THREE.MeshStandardMaterial({
      map: stripeTexture,
      roughness: 0.85,
      metalness: 0.0,
    })
  );
  tower.position.y = towerHeight / 2;
  group.add(tower);

  // White ring below lantern
  const ringHeight = 6;
  const ring = new THREE.Mesh(
    new THREE.CylinderGeometry(14, 14, ringHeight, 48),
    new THREE.MeshStandardMaterial({
      color: 0xffffff,
      roughness: 0.7,
    })
  );
  ring.position.y = towerHeight + ringHeight / 2;
  group.add(ring);

  // Lantern room
  const lanternHeight = 12;
  const lantern = new THREE.Mesh(
    new THREE.CylinderGeometry(10, 12, lanternHeight, 48),
    new THREE.MeshStandardMaterial({
      color: 0xf2f2f2,
      roughness: 0.4,
      metalness: 0.05,
    })
  );
  lantern.position.y = towerHeight + ringHeight + lanternHeight / 2;
  group.add(lantern);

  // Red roof
  const roofHeight = 14;
  const roof = new THREE.Mesh(
    new THREE.ConeGeometry(16, roofHeight, 48),
    new THREE.MeshStandardMaterial({
      color: 0xb31313,
      roughness: 0.7,
    })
  );
  roof.position.y = towerHeight + ringHeight + lanternHeight + roofHeight / 2;
  group.add(roof);

  // Good center point for intro camera to aim at
  function getAimPoint() {
    const p = new THREE.Vector3();
    group.getWorldPosition(p);                 // world base of lighthouse group
    p.y += towerHeight * 0.6;                  // aim mid-tower
    return p;
  }

  // Exact lantern position in world space
  function getLanternWorldPosition() {
    const lanternWorld = new THREE.Vector3();
    lantern.getWorldPosition(lanternWorld);
    return lanternWorld;
  }

  return {
    group,
    getAimPoint,
    getLanternWorldPosition,
  };
}
