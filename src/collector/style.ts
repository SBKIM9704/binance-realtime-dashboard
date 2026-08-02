/**
 * Terminal styling for the collector's console output.
 *
 * Colour is emitted only for a TTY and never when NO_COLOR is set, so redirecting
 * the log to a file leaves clean text. Shared by the banner and the progress block
 * so the two never disagree about whether this terminal takes escape codes.
 */
export const isTTY = Boolean(process.stdout.isTTY);
export const useColor = isTTY && !process.env.NO_COLOR;

const ESC = "\u001b[";

const paint = (code: string, s: string) => (useColor ? `${ESC}${code}m${s}${ESC}0m` : s);

export const amber = (s: string) => paint("38;5;214", s);
export const dim = (s: string) => paint("2", s);
export const bold = (s: string) => paint("1", s);
export const green = (s: string) => paint("32", s);
export const red = (s: string) => paint("31", s);
