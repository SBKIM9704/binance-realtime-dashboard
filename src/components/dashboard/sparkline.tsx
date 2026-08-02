import { useId } from "react";

/**
 * Lightweight inline-SVG sparkline — no chart library overhead.
 *
 * `width`/`height` set the coordinate space and the intrinsic size; a caller that
 * passes sizing classes (`h-full`) stretches it instead, since CSS wins over the
 * presentation attributes. The stroke stays 1.5px under any stretch.
 */
export function Sparkline({
  data,
  width = 132,
  height = 40,
  color = "hsl(var(--primary))",
  className,
}: {
  data: number[];
  width?: number;
  height?: number;
  color?: string;
  className?: string;
}) {
  // Before the early return: hooks must run in the same order on every render.
  // useId rather than a value hash, because two cards sharing a rounded minimum and
  // series length would otherwise share one gradient definition.
  const gradId = `spark-${useId().replace(/:/g, "")}`;

  if (data.length < 2) {
    return <svg width={width} height={height} className={className} aria-hidden />;
  }

  const min = Math.min(...data);
  const max = Math.max(...data);
  const mid = (min + max) / 2;

  /**
   * Floor on the vertical scale, as a fraction of price.
   *
   * Plain min-max normalisation makes every series fill the full height, so a
   * minute in which BTC moved 0.01% renders as an identical cliff to one where it
   * moved 2%. The sparkline is there to show how much the price moved, so a
   * near-flat minute has to read as flat.
   */
  const MIN_RELATIVE_SPAN = 0.002;
  const span = Math.max(max - min, Math.abs(mid) * MIN_RELATIVE_SPAN) || 1;
  const stepX = width / (data.length - 1);

  const points = data.map((v, i) => {
    const x = i * stepX;
    // Centred on the mid-price, so inflating the span keeps the line in the middle
    // instead of pinning it to the floor.
    const norm = 0.5 + (v - mid) / span;
    const y = height - norm * (height - 4) - 2;
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  });

  const areaPath = `M0,${height} L${points.join(" L")} L${width},${height} Z`;

  return (
    <svg
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      preserveAspectRatio="none"
      className={className}
      aria-hidden
    >
      <defs>
        <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.28" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={areaPath} fill={`url(#${gradId})`} />
      <polyline
        points={points.join(" ")}
        fill="none"
        stroke={color}
        strokeWidth="1.5"
        strokeLinejoin="round"
        strokeLinecap="round"
        vectorEffect="non-scaling-stroke"
      />
    </svg>
  );
}
