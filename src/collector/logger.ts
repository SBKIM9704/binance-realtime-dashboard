/** Tiny timestamped logger for the collector process. */

/**
 * A block of lines the console keeps redrawing at the bottom of the screen (the
 * backfill progress bars). Log output has to write around it, or a line printed
 * mid-redraw lands inside the block and the display smears.
 */
export interface LiveRegion {
  /** Erase the block from the terminal. */
  clear(): void;
  /** Draw it again, below whatever was just printed. */
  redraw(): void;
}

let live: LiveRegion | null = null;

/** Register (or clear, with `null`) the block that log output must write around. */
export function setLiveRegion(region: LiveRegion | null): void {
  live = region;
}

function emit(write: (...args: unknown[]) => void, args: unknown[]): void {
  live?.clear();
  write(...args);
  live?.redraw();
}

export function log(...args: unknown[]): void {
  emit(console.log, [new Date().toISOString(), ...args]);
}

export function logError(...args: unknown[]): void {
  emit(console.error, [new Date().toISOString(), ...args]);
}

/** Print pre-formatted text (banner, ready card) without a timestamp prefix. */
export function logRaw(text: string): void {
  emit(console.log, [text]);
}
