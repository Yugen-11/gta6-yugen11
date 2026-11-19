// Palmar Bay — tuning and world constants. One place for every number the
// rest of the game shares, so a balance change never means hunting through
// the simulation code.

export const WORLD = {
  // City grid: GRID blocks a side, BLOCK metres of buildings, ROAD metres of
  // asphalt between them. Block centres sit at (i - HALF) * PITCH.
  GRID: 9,
  PITCH: 58,
  BLOCK: 44,
  ROAD: 14,
  // South of this z the sand starts; past it, the sea.
  BEACH_Z: 250,
  WATER_Z: 296,
  // Playable bounds (a fence of palms and water keeps the player in).
  BOUND: 268,
};

export const CITY_HALF = ((WORLD.GRID - 1) / 2) * WORLD.PITCH; // 232

export const DAY = {
  // Warm late-afternoon sun, the look the whole game is graded on.
  SUN_COLOR: 0xffd9a0,
  SUN_INTENSITY: 2.6,
  SUN_ELEVATION: 38, // degrees
  SUN_AZIMUTH: 215, // degrees, from the south-west so the beach glows
  SKY_TOP: 0x3f8fd2,
  SKY_HORIZON: 0xffd9a8,
  FOG_COLOR: 0xf2c98f,
  FOG_NEAR: 180,
  FOG_FAR: 620,
  HEMI_SKY: 0xbfd9ff,
  HEMI_GROUND: 0x8a6f4d,
  HEMI_INTENSITY: 1.05,
};

export const PLAYER = {
  WALK_SPEED: 5.2,
  SPRINT_SPEED: 8.6,
  ACCEL: 34,
  JUMP_SPEED: 7.5,
  GRAVITY: 20,
  RADIUS: 0.55,
  HEALTH_MAX: 100,
  HEALTH_REGEN_DELAY: 5,
  HEALTH_REGEN_RATE: 8,
};

export const CAR = {
  // Arcade handling per kind: engine force, top speed, grip, brake.
  KINDS: {
    sedan: { accel: 16, topSpeed: 34, reverseSpeed: 12, grip: 6.5, brake: 30, price: 0 },
    sport: { accel: 24, topSpeed: 46, reverseSpeed: 14, grip: 8.5, brake: 36, price: 0 },
    taxi: { accel: 15, topSpeed: 32, reverseSpeed: 12, grip: 6.5, brake: 30, price: 0 },
    van: { accel: 12, topSpeed: 28, reverseSpeed: 10, grip: 5.5, brake: 26, price: 0 },
    truck: { accel: 11, topSpeed: 26, reverseSpeed: 9, grip: 5.0, brake: 24, price: 0 },
    police: { accel: 22, topSpeed: 42, reverseSpeed: 13, grip: 8.0, brake: 34, price: 0 },
  },
  RADIUS: 2.1,
  ENTER_RADIUS: 4.5,
  STEAL_HEAT: 1.0, // wanted heat added by stealing a car: one full star
};

export const TRAFFIC = {
  CAR_COUNT: 12,
  PED_COUNT: 22,
  CAR_SPEED: 11,
  CAR_SPEED_VAR: 4,
  PED_SPEED: 1.4,
  PED_SPEED_VAR: 0.5,
  DESPAWN_RADIUS: 170,
  SPAWN_RADIUS_MIN: 60,
  SPAWN_RADIUS_MAX: 150,
};

export const WANTED = {
  STARS: 5,
  // Heat 0..1 fills one star; crimes add heat, hiding drains it.
  DECAY_PER_SECOND: 0.022,
  DECAY_HIDDEN_MULT: 2.4,
  HIT_PED_HEAT: 1.0,
  SHOOT_HEAT: 0.25,
  KILL_COP_HEAT: 0.8,
  MAX_POLICE_CARS: 5,
  POLICE_SPAWN_RADIUS: 85,
  BUST_DISTANCE: 2.6,
  BUST_TIME: 1.6,
  BUST_FINE: 250,
  WASTED_FINE: 150,
};

export const COMBAT = {
  PISTOL_RANGE: 70,
  PISTOL_DAMAGE: 34,
  PISTOL_COOLDOWN: 0.28,
  PISTOL_SPREAD: 0.012,
  ENEMY_HEALTH: 50,
  ENEMY_DAMAGE: 7,
  ENEMY_RANGE: 42,
  ENEMY_SHOT_INTERVAL: 1.15,
  ENEMY_ACCURACY: 0.42,
};

export const SAVE_KEY = 'palmar-bay-save-v1';
export const SAVE_VERSION = 1; // bump when the save format changes; old saves are ignored

export const CAMERA = {
  BASE_FOV: 62, // degrees, the chase camera's resting field of view
  SPEED_FOV_BONUS: 6, // degrees added at top speed, for the sense of speed
};

export const MISSION_REWARDS = [300, 500, 800, 1000, 1500, 5000];
