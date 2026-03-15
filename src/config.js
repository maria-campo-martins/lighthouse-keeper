export const CONFIG = {
  // Lighthouse keeper camera (eye space: view from the tower)
  cameraHeight: 4,
  cameraFov: 60,
  cameraNear: 0.1,
  cameraFar: 2000,
  cameraPosY: 90,
  cameraPosZ: 120,
  cameraLookZ: 500,

  // Ocean plane (world space: horizon in front of the keeper)
  oceanSize: 1200,
  oceanSegments: 32,

  // Night atmosphere — visible dark blues so horizon is clear from the start
  ambientIntensity: 0.35,
  ambientColor: 0x2a2f44,

  skyColorNight:   0x75a4d5,
  oceanColorNight: 0x75a4d5,
  fogColorNight: 0x75a4d5,
  fogNear: 700,
  fogFar: 2000,

  // Dawn
  skyColorDawn: 0x75a4d5,
  oceanColorDawn: 0x75a4d5,
  fogColorDawn: 0x75a4d5,

  // Intro-only ocean colors (distinct from play section)
  introOceanColorDawn: 0x0b2740,
  introOceanColorNight: 0x0b2740,

  // Lighthouse beam
  beamLength: 800,
  beamRadius: 50,
  beamSegments: 24,
  beamColor: 0xffffaa,
  beamOpacity: 0.35,
  beamRotationSpeed: 0.02,
  beamInitialYaw: 3.11,      // Initial horizontal rotation (left/right) in radians
  beamInitialPitch: -0.06,    // Initial vertical rotation (up/down) in radians
  lampOffsetX: 0,
  lampOffsetY: -2,
  lampOffsetZ: -2.0,

  // One full loop duration (seconds) — ships + sunrise synced to this
  cycleDuration: 120,
  cycleShipCount: 5,
  cycleSpawnStart: 0.0,
  cycleSpawnEnd: 15.0,

  // Ship path (used to compute deterministic speed)
  shipSpawnZ: 550,
  shipArriveZ: 30,
  shipSpawnXMin: -120,
  shipSpawnXMax: 120,
  shipY: 0.6,
};

export const MODE = { INTRO: "INTRO", PLAY: "PLAY", END_GAME: "END_GAME" };
