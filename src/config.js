export const CONFIG = {
  // Lighthouse keeper camera (eye space: view from the tower)
  cameraHeight: 4,
  cameraFov: 60,
  cameraNear: 0.1,
  cameraFar: 2000,
  cameraPosY: 80,
  cameraPosZ: 120,
  cameraLookZ: 300,

  // Ocean plane (world space: horizon in front of the keeper)
  oceanSize: 1200,
  oceanSegments: 32,

  // Night atmosphere — visible dark blues so horizon is clear from the start
  ambientIntensity: 0.15,
  ambientColor: 0x1a1a2e,
  skyColorNight: 0x0a1428,
  oceanColorNight: 0x030a17,
  fogNear: 400,
  fogFar: 1200,
  fogColorNight: 0x080c18,

  // Dawn
  skyColorDawn: 0x87ceeb,
  oceanColorDawn: 0x0d4d87,
  fogColorDawn: 0x87ceeb,

  // Lighthouse beam
  beamLength: 800,
  beamRadius: 50,
  beamSegments: 24,
  beamColor: 0xffffaa,
  beamOpacity: 0.35,
  beamRotationSpeed: 0.02,
  beamInitialYaw: 3.11,      // Initial horizontal rotation (left/right) in radians
  beamInitialPitch: -0.24,    // Initial vertical rotation (up/down) in radians
  lampOffsetX: 0,
  lampOffsetY: -2,
  lampOffsetZ: -2.0,

  // One full loop duration (seconds) — ships + sunrise synced to this
  cycleDuration: 120,
  cycleShipCount: 3,
  cycleSpawnStart: 0.0,
  cycleSpawnEnd: 30.0,

  // Ship path (used to compute deterministic speed)
  shipSpawnZ: 550,
  shipArriveZ: 30,
  shipLaneX: [-80, 0, 80],
  shipY: 0.6,
};

export const MODE = { INTRO: "INTRO", PLAY: "PLAY" };
