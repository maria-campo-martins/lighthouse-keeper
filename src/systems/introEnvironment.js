import * as THREE from "three";
import { createLighthouse } from "./lighthouseModel.js";

/**
 * Creates a moss/grass texture using canvas
 */
function makeMossGrassTexture(renderer) {
  const canvas = document.createElement("canvas");
  canvas.width = 512;
  canvas.height = 512;

  const ctx = canvas.getContext("2d");
  
  // Base moss green color (brighter green)
  ctx.fillStyle = "#4a7a4a";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  
  // Add variation with darker and lighter patches
  for (let i = 0; i < 200; i++) {
    const x = Math.random() * canvas.width;
    const y = Math.random() * canvas.height;
    const size = Math.random() * 30 + 10;
    const alpha = Math.random() * 0.3 + 0.1;
    
    // Randomly choose darker or lighter moss
    if (Math.random() > 0.5) {
      ctx.fillStyle = `rgba(60, 100, 60, ${alpha})`; // Darker moss
    } else {
      ctx.fillStyle = `rgba(80, 120, 80, ${alpha})`; // Lighter moss
    }
    
    ctx.beginPath();
    ctx.arc(x, y, size, 0, Math.PI * 2);
    ctx.fill();
  }
  
  // Add grass-like texture with small strokes
  ctx.strokeStyle = "#5a8a5a";
  ctx.lineWidth = 1;
  for (let i = 0; i < 500; i++) {
    const x = Math.random() * canvas.width;
    const y = Math.random() * canvas.height;
    const length = Math.random() * 8 + 2;
    const angle = Math.random() * Math.PI * 2;
    
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(
      x + Math.cos(angle) * length,
      y + Math.sin(angle) * length
    );
    ctx.stroke();
  }
  
  // Add some brown patches (dirt/decay)
  for (let i = 0; i < 50; i++) {
    const x = Math.random() * canvas.width;
    const y = Math.random() * canvas.height;
    const size = Math.random() * 15 + 5;
    ctx.fillStyle = `rgba(60, 45, 35, ${Math.random() * 0.2 + 0.1})`;
    ctx.beginPath();
    ctx.arc(x, y, size, 0, Math.PI * 2);
    ctx.fill();
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(4, 4); // Repeat texture for tiling
  texture.anisotropy = renderer.capabilities.getMaxAnisotropy();
  
  return texture;
}

/**
 * Creates a bump/normal map for the moss texture
 */
function makeMossBumpTexture() {
  const canvas = document.createElement("canvas");
  canvas.width = 512;
  canvas.height = 512;

  const ctx = canvas.getContext("2d");
  
  // Create noise pattern for bump mapping
  const imageData = ctx.createImageData(canvas.width, canvas.height);
  const data = imageData.data;
  
  for (let i = 0; i < data.length; i += 4) {
    const value = Math.random() * 128 + 128; // Grayscale value
    data[i] = value;     // R
    data[i + 1] = value; // G
    data[i + 2] = value; // B
    data[i + 3] = 255;   // A
  }
  
  ctx.putImageData(imageData, 0, 0);

  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(4, 4);
  
  return texture;
}

/**
 * Creates a simple rock mesh for platform decoration
 */
function makePlatformRock({ radius = 2 } = {}) {
  const geo = new THREE.IcosahedronGeometry(radius, 0);
  const mat = new THREE.MeshStandardMaterial({ 
    color: 0x3a3a3a,
    roughness: 0.9,
    metalness: 0.0
  });
  const mesh = new THREE.Mesh(geo, mat);
  
  // Make rocks irregular
  const scaleX = 0.7 + Math.random() * 0.6;
  const scaleY = 0.4 + Math.random() * 0.4;
  const scaleZ = 0.7 + Math.random() * 0.6;
  mesh.scale.set(scaleX, scaleY, scaleZ);
  mesh.rotation.set(
    Math.random() * Math.PI,
    Math.random() * Math.PI,
    Math.random() * Math.PI
  );
  
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  
  return mesh;
}

/**
 * Creates an ocean rock mesh for intro scene
 */
function makeOceanRock({ radius = 5 } = {}) {
  const geo = new THREE.IcosahedronGeometry(radius, 0);
  const mat = new THREE.MeshStandardMaterial({ 
    color: 0x2e2e2e,
    roughness: 0.95,
    metalness: 0.0
  });
  const mesh = new THREE.Mesh(geo, mat);
  
  // Make rocks irregular
  const scaleX = 0.8 + Math.random() * 0.4;
  const scaleY = 0.5 + Math.random() * 0.5;
  const scaleZ = 0.8 + Math.random() * 0.4;
  mesh.scale.set(scaleX, scaleY, scaleZ);
  mesh.rotation.set(
    Math.random() * Math.PI,
    Math.random() * Math.PI,
    Math.random() * Math.PI
  );
  
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  
  return mesh;
}

/**
 * Intro environment = cliff/land + lighthouse + distant sea + blue sunset lighting.
 * Returns a root group you can toggle on/off.
 */
export function createIntroEnvironment(scene, renderer, CONFIG) {
  const root = new THREE.Group();
  root.name = "IntroEnvironment";
  scene.add(root);

  // --- Intro sky/fog (blue sunset -> dark night)
  const bgSunsetStart = new THREE.Color(0x4a90e2); // Blue sky
  const bgSunsetEnd = new THREE.Color(CONFIG.skyColorNight); // Dark night sky
  const fogSunset = new THREE.FogExp2(0x6ba3d6, 0.0012); // Blue atmospheric fog
  const fogColorStart = new THREE.Color(0x6ba3d6); // Blue fog
  const fogColorEnd = new THREE.Color(CONFIG.fogColorNight); // Dark night fog

  // --- Lighting (blue sunset -> dark night)
  const ambient = new THREE.AmbientLight(0x87ceeb, 0.4); // Blue ambient light
  const ambientColorStart = new THREE.Color(0x87ceeb); // Blue ambient
  const ambientColorEnd = new THREE.Color(CONFIG.ambientColor); // Dark night ambient
  root.add(ambient);

  // Calculate plateau top Y for lighthouse positioning
  const plateauTopY = 35 + 70 / 2;

  // Sun light - will arc up and over lighthouse towards camera
  const sun = new THREE.DirectionalLight(0xffe469, 1.8); // Yellow sun light
  // Sun path: starts behind lighthouse, arcs up and over, moves towards camera and off screen
  const sunStartPos = new THREE.Vector3(0, 200, -300);  // Behind lighthouse, high
  const sunMidPos = new THREE.Vector3(0, 350, 0);        // Over lighthouse
  const sunEndPos = new THREE.Vector3(0, 400, 500);      // Above camera, forward, off screen
  sun.position.copy(sunStartPos);
  sun.castShadow = false;
  root.add(sun);

  // Additional spotlight pointing at lighthouse to create visible rays
  const lighthouseSpot = new THREE.SpotLight(0x6ba3d6, 2.0, 1000, Math.PI / 6, 0.3, 2);
  lighthouseSpot.position.copy(sunStartPos);
  lighthouseSpot.target.position.set(0, plateauTopY + 70, 20); // Point at lighthouse
  root.add(lighthouseSpot);
  root.add(lighthouseSpot.target);

  // Visible sun sphere (3D with proper lighting and shadows)
  const sunGeometry = new THREE.SphereGeometry(60, 64, 64); // Higher resolution for better 3D look
  const sunMaterial = new THREE.MeshStandardMaterial({ 
    color: 0xffaa00, // Warm orange-yellow sun color
    emissive: 0xff8800, // Bright glowing orange
    emissiveIntensity: 2.5, // Strong self-illumination like a real sun
    roughness: 0.95, // Matte, non-reflective surface (like actual sun)
    metalness: 0.0,
    fog: false, // Don't fade with fog
    transparent: true, // Enable transparency for fade out
    opacity: 1.0
  });
  const sunMesh = new THREE.Mesh(sunGeometry, sunMaterial);
  sunMesh.position.copy(sunStartPos); // Start behind lighthouse
  sunMesh.castShadow = true;
  sunMesh.receiveShadow = true;
  root.add(sunMesh);
  
  // Point light at sun position for volumetric lighting effect
  const sunPointLight = new THREE.PointLight(0xffe469, 3.0, 2000);
  sunPointLight.position.copy(sunStartPos);
  sunPointLight.castShadow = true;
  sunPointLight.shadow.mapSize.width = 2048;
  sunPointLight.shadow.mapSize.height = 2048;
  sunPointLight.shadow.camera.near = 0.5;
  sunPointLight.shadow.camera.far = 2000;
  root.add(sunPointLight);

  // Additional blue fill light from opposite side
  const fillLight = new THREE.DirectionalLight(0xb0d4e6, 0.5);
  fillLight.position.set(200, 100, 200);
  root.add(fillLight);

  // --- Cliff / land (simple stylized block + slope)
  // Create moss/grass texture for the platform
  const mossTexture = makeMossGrassTexture(renderer);
  const mossBumpTexture = makeMossBumpTexture();
  
  const landMat = new THREE.MeshStandardMaterial({ 
    color: 0x5a8a5a, // Brighter moss green color
    map: mossTexture,
    bumpMap: mossBumpTexture,
    bumpScale: 0.3,
    roughness: 0.95,
    metalness: 0.0
  });

  // Platform dimensions - peninsula extending behind camera
  const platformWidth = 180;
  const platformFrontDepth = 80; // Depth in front of lighthouse
  const platformBackDepth = 400; // Depth behind lighthouse (extends behind camera)
  const platformHeight = 70;
  
  // Main platform section (front part with lighthouse)
  const plateau = new THREE.Mesh(new THREE.BoxGeometry(platformWidth, platformHeight, platformFrontDepth), landMat);
  plateau.position.set(0, 35, platformFrontDepth / 2);
  plateau.castShadow = true;
  plateau.receiveShadow = true;
  root.add(plateau);
  
  // Peninsula extension going backward (tapered to look more natural)
  const peninsulaLength = platformBackDepth;
  const peninsulaStartWidth = platformWidth;
  const peninsulaEndWidth = 120; // Tapered narrower at the back
  
  // Create peninsula as a series of segments that taper
  const peninsulaSegments = 4;
  for (let i = 0; i < peninsulaSegments; i++) {
    const t = i / peninsulaSegments;
    const nextT = (i + 1) / peninsulaSegments;
    const segmentLength = peninsulaLength / peninsulaSegments;
    const startWidth = peninsulaStartWidth + (peninsulaEndWidth - peninsulaStartWidth) * t;
    const endWidth = peninsulaStartWidth + (peninsulaEndWidth - peninsulaStartWidth) * nextT;
    const avgWidth = (startWidth + endWidth) / 2;
    
    const segment = new THREE.Mesh(
      new THREE.BoxGeometry(avgWidth, platformHeight, segmentLength),
      landMat
    );
    segment.position.set(
      0,
      35,
      platformFrontDepth + segmentLength * (i + 0.5)
    );
    segment.castShadow = true;
    segment.receiveShadow = true;
    root.add(segment);
  }
  
  // Add rocks scattered on the platform surface
  const platformTopY = 35 + platformHeight / 2; // Top of the plateau
  const platformHalfWidth = platformWidth / 2; // Half width of platform
  const totalPlatformDepth = platformFrontDepth + platformBackDepth;
  const platformHalfDepth = totalPlatformDepth / 2; // Half depth of total platform
  
  // Create a group for platform rocks
  const platformRocks = new THREE.Group();
  platformRocks.name = "PlatformRocks";
  
  // Add 8-12 rocks scattered on the platform
  const rockCount = 10;
  for (let i = 0; i < rockCount; i++) {
    const rock = makePlatformRock({ radius: 1.5 + Math.random() * 2 });
    
    // Position rocks randomly on platform surface, avoiding center where lighthouse is
    // Spread rocks across the peninsula (both front and back)
    let x, z;
    let attempts = 0;
    do {
      x = (Math.random() - 0.5) * platformHalfWidth * 1.6; // Slightly wider spread
      // Position along the full peninsula length (front to back)
      z = platformFrontDepth / 2 + Math.random() * (platformFrontDepth + platformBackDepth) - platformHalfDepth;
      attempts++;
    } while (Math.sqrt(x * x + (z - platformFrontDepth / 2) * (z - platformFrontDepth / 2)) < 20 && attempts < 20); // Keep away from lighthouse base
    
    rock.position.set(x, platformTopY + rock.scale.y * 1.5, z);
    platformRocks.add(rock);
  }
  
  root.add(platformRocks);


  // --- Distant ocean behind cliff (blue colors)
  // Ocean color transitions from dawn to night during intro
  const oceanColorStart = new THREE.Color(CONFIG.oceanColorDawn);
  const oceanColorEnd = new THREE.Color(CONFIG.oceanColorNight);
  
  const oceanMat = new THREE.MeshStandardMaterial({ 
    color: oceanColorStart.clone(), 
    roughness: 0.25, 
    metalness: 0.05 
  });
  const ocean = new THREE.Mesh(
    new THREE.PlaneGeometry(2400, 2400, 1, 1),
    oceanMat
  );
  ocean.rotation.x = -Math.PI / 2;
  ocean.position.set(0, 0, -1000);
  root.add(ocean);

  // --- Ocean rocks for intro scene
  const oceanRocks = new THREE.Group();
  oceanRocks.name = "OceanRocks";
  const oceanRockCount = 15; // Number of rocks in the ocean
  const oceanY = 0; // Ocean surface level
  
  for (let i = 0; i < oceanRockCount; i++) {
    const rockRadius = 4 + Math.random() * 8; // Rocks between 4-12 radius
    const rock = makeOceanRock({ radius: rockRadius });
    
    // Position rocks in the ocean area (spread out around z=-1000)
    const x = (Math.random() - 0.5) * 800; // Spread across width
    const z = -1000 + (Math.random() - 0.5) * 600; // Around ocean center, spread forward/back
    
    // Position rock slightly above water surface based on its scaled height
    rock.position.set(x, oceanY + rockRadius * rock.scale.y * 0.3, z);
    oceanRocks.add(rock);
  }
  
  root.add(oceanRocks);

  // --- Lighthouse (reuse your model module)
  const lighthouse = createLighthouse(renderer, CONFIG);
  lighthouse.group.position.set(0, plateauTopY + 0.05, 20);
  root.add(lighthouse.group);

  // Enhance lighthouse materials for better sun reflection
  lighthouse.group.traverse((child) => {
    if (child.isMesh && child.material) {
      // Make materials more reflective to catch sun's shine
      if (child.material.roughness !== undefined) {
        child.material.roughness = Math.max(0.3, child.material.roughness * 0.6); // More reflective
      }
      if (child.material.metalness !== undefined) {
        child.material.metalness = Math.min(0.3, child.material.metalness + 0.1); // Slight metallic shine
      }
    }
  });

  function setActive(active) {
    root.visible = active;
    if (active) {
      scene.background = bgSunsetStart.clone();
      scene.fog = fogSunset;
      fogSunset.color.copy(fogColorStart);
      ambient.color.copy(ambientColorStart);
      // Reset sun to start position and opacity
      sunMesh.position.copy(sunStartPos);
      sun.position.copy(sunStartPos);
      sunMesh.material.opacity = 1.0;
      // Reset spotlight
      lighthouseSpot.position.copy(sunStartPos);
      lighthouseSpot.target.position.set(0, plateauTopY + 70, 20);
      // Reset point light
      sunPointLight.position.copy(sunStartPos);
    }
  }

  // Update sun position during intro (sun arcs up and over lighthouse)
  function updateSunset(progress) {
    // progress is 0 to 1 over the intro duration
    // Sun arcs up and over lighthouse, moving towards camera and off screen
    const currentPos = new THREE.Vector3();
    
    if (progress < 0.5) {
      // First half: arc from start to mid (behind lighthouse to over lighthouse)
      const t = progress / 0.5; // 0 to 1 over first half
      currentPos.lerpVectors(sunStartPos, sunMidPos, t);
      // Add upward arc motion
      const arcHeight = 50 * Math.sin(t * Math.PI); // Arc up
      currentPos.y += arcHeight;
    } else {
      // Second half: arc from mid to end (over lighthouse to above camera, off screen)
      const t = (progress - 0.5) / 0.5; // 0 to 1 over second half
      currentPos.lerpVectors(sunMidPos, sunEndPos, t);
      // Continue arc motion
      const arcHeight = 30 * Math.sin(t * Math.PI); // Continue arc
      currentPos.y += arcHeight;
    }
    
    sunMesh.position.copy(currentPos);
    sun.position.copy(currentPos);
    sunPointLight.position.copy(currentPos); // Move point light with sun
    
    // Update spotlight to follow sun and point at lighthouse (creates visible rays)
    lighthouseSpot.position.copy(currentPos);
    const lighthousePos = new THREE.Vector3(0, plateauTopY + 70, 20);
    lighthouseSpot.target.position.copy(lighthousePos);
    
    // Increase spotlight intensity when sun is over lighthouse (progress 0.3-0.7)
    if (progress >= 0.3 && progress <= 0.7) {
      const intensityFactor = Math.sin((progress - 0.3) / 0.4 * Math.PI); // Peak at 0.5
      lighthouseSpot.intensity = 2.0 + (intensityFactor * 1.5); // 2.0 to 3.5
      sun.intensity = 1.8 + (intensityFactor * 0.7); // 1.8 to 2.5
    } else {
      lighthouseSpot.intensity = 2.0;
      sun.intensity = 1.8;
    }
    
    // Fade out sun as it moves off screen (last 30% of animation)
    if (progress > 0.7) {
      const fadeProgress = (progress - 0.7) / 0.3; // 0 to 1 over last 30%
      sunMesh.material.opacity = 1.0 - fadeProgress;
      lighthouseSpot.intensity *= (1.0 - fadeProgress);
      sunPointLight.intensity = 3.0 * (1.0 - fadeProgress);
    } else {
      sunMesh.material.opacity = 1.0;
      sunPointLight.intensity = 3.0;
    }
    
    // Rotate sun slowly for dynamic 3D effect (based on progress)
    sunMesh.rotation.y = progress * Math.PI * 0.5; // Rotate 90 degrees over the animation
    sunMesh.rotation.x = progress * Math.PI * 0.2; // Slight tilt rotation
    
    // Update fog density/intensity based on sun position (more atmospheric as sun moves)
    // Increase fog more dramatically when sun is over lighthouse for visible rays
    let fogDensity = 0.0012;
    if (progress >= 0.3 && progress <= 0.7) {
      const rayIntensity = Math.sin((progress - 0.3) / 0.4 * Math.PI);
      fogDensity = 0.0012 + (rayIntensity * 0.001); // Peak at 0.0022 for visible rays
    } else {
      fogDensity = 0.0012 + (progress * 0.0006);
    }
    fogSunset.density = fogDensity;
    
    // Interpolate colors from blue sunset to dark night
    // Background color transition
    const bgColor = new THREE.Color();
    bgColor.lerpColors(bgSunsetStart, bgSunsetEnd, progress);
    scene.background = bgColor;
    
    // Fog color transition
    const fogColor = new THREE.Color();
    fogColor.lerpColors(fogColorStart, fogColorEnd, progress);
    fogSunset.color.copy(fogColor);
    
    // Ambient light color transition
    const ambientColor = new THREE.Color();
    ambientColor.lerpColors(ambientColorStart, ambientColorEnd, progress);
    ambient.color.copy(ambientColor);
    
    // Also fade ambient intensity as it gets darker
    ambient.intensity = 0.4 - (progress * 0.25); // Fade from 0.4 to 0.15
    
    // Ocean color transition from dawn to night
    const oceanColor = new THREE.Color();
    oceanColor.lerpColors(oceanColorStart, oceanColorEnd, progress);
    oceanMat.color.copy(oceanColor);
  }

  return {
    root,
    setActive,
    updateSunset,
    lighthouse, 
    plateauTopY
  };
}