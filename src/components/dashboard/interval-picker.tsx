"use client";

import { ToggleGroup } from "@/components/dashboard/toggle-group";
import { useApp } from "@/components/providers";
import type { TKey } from "@/lib/i18n";
import { groupIntervals } from "@/lib/intervals";

/**
 * Period bar in the Korean exchange idiom (Bithumb, Upbit): the unit is written
 * once and the reader picks a number under it, rather than reading "1분 3분 5분
 * 15분" as eight separate words. Groups appear in ascending duration.
 */
export function IntervalPicker({
  intervals,
  active,
  onSelect,
}: {
  intervals: string[];
  active: string;
  onSelect: (interval: string) => void;
}) {
  const { t } = useApp();
  const groups = groupIntervals(intervals);

  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5">
      <span className="label">{t("interval.period")}</span>
      {groups.map(({ unit, items }) => (
        <div key={unit} className="flex items-center gap-1.5">
          <span className="text-[10px] text-muted-foreground">
            {t(`interval.unit.${unit}` as TKey)}
          </span>
          <ToggleGroup
            items={items.map((i) => ({ value: i.value, label: i.n }))}
            active={active}
            onSelect={onSelect}
            variant="plain"
            ariaLabel={t(`interval.unit.${unit}` as TKey)}
          />
        </div>
      ))}
    </div>
  );
}
