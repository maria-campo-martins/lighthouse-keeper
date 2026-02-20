export function createCycleManager(CONFIG, onCycleStart) {
  let lastCycleIndex = -1;

  function progress(time) {
    const tCycle = time % CONFIG.cycleDuration;
    return tCycle / CONFIG.cycleDuration;
  }

  function update(time) {
    const idx = Math.floor(time / CONFIG.cycleDuration);
    if (idx !== lastCycleIndex) {
      lastCycleIndex = idx;
      onCycleStart?.(idx);
    }
    return progress(time);
  }

  return { update, progress };
}