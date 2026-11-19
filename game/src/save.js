// Palmar Bay — saving. One small JSON object in localStorage: the money,
// the mission the player is on, and where they were standing. Nothing else
// needs to survive: the city is deterministic, the cars respawn, and the
// police forget. The object carries a version, so a save from an older
// format is ignored instead of half-loaded.

import { SAVE_KEY, SAVE_VERSION } from './config.js';

export function loadSave() {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) return null;
    const data = JSON.parse(raw);
    if (typeof data !== 'object' || data === null) return null;
    if (data.v !== SAVE_VERSION) return null; // an older save format
    return {
      money: typeof data.money === 'number' ? data.money : 0,
      missionIndex: typeof data.missionIndex === 'number' ? data.missionIndex : 0,
      playerX: typeof data.playerX === 'number' ? data.playerX : null,
      playerZ: typeof data.playerZ === 'number' ? data.playerZ : null,
      muted: data.muted === true,
      completed: data.completed === true,
    };
  } catch {
    return null;
  }
}

export function writeSave(data) {
  try {
    localStorage.setItem(SAVE_KEY, JSON.stringify({ ...data, v: SAVE_VERSION }));
    return true;
  } catch {
    return false;
  }
}

export function clearSave() {
  try {
    localStorage.removeItem(SAVE_KEY);
  } catch {
    // A browser that refuses storage simply plays without a save.
  }
}
