import type { Lang } from "./i18n";

/**
 * Which colour token paints a rise and a fall.
 *
 * Korean exchanges (Upbit, Bithumb) paint 상승 red and 하락 blue; western charts use
 * green/red. This is the single definition — canvas code resolves the token to an
 * `hsl()` string, DOM code resolves it to a Tailwind class. Encoding the rule twice
 * is how a chart ends up disagreeing with the price beside it.
 */
const TREND_TOKENS = {
  ko: { up: "danger", down: "info" },
  en: { up: "success", down: "danger" },
} as const;

export type TrendToken = (typeof TREND_TOKENS)[Lang][keyof (typeof TREND_TOKENS)["ko"]];

/** CSS custom-property name for a rise/fall, e.g. `--danger`. For canvas colours. */
export function trendVar(lang: Lang, rising: boolean): string {
  return `--${TREND_TOKENS[lang][rising ? "up" : "down"]}`;
}

// Static maps: Tailwind only keeps classes it can see as literals.
const TEXT: Record<TrendToken, string> = {
  success: "text-success",
  danger: "text-danger",
  info: "text-info",
};

const BG_SOFT: Record<TrendToken, string> = {
  success: "bg-success/10",
  danger: "bg-danger/10",
  info: "bg-info/10",
};

/** Tailwind text colour for a rise/fall. */
export function trendText(lang: Lang, rising: boolean): string {
  return TEXT[TREND_TOKENS[lang][rising ? "up" : "down"]];
}

/** Tailwind tinted background for a rise/fall, for pills and badges. */
export function trendBg(lang: Lang, rising: boolean): string {
  return BG_SOFT[TREND_TOKENS[lang][rising ? "up" : "down"]];
}
