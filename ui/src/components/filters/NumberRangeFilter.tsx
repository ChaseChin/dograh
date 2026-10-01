import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NumberRangeValue } from "@/types/filters";

interface NumberRangeFilterProps {
  value: NumberRangeValue;
  onChange: (value: NumberRangeValue) => void;
  error?: string;
  unit?: string;
  min?: number;
  max?: number;
  step?: number;
  presets?: { label: string; labelKey?: string; min: number; max: number }[];
}

export const NumberRangeFilter: React.FC<NumberRangeFilterProps> = ({
  value,
  onChange,
  error,
  unit,
  min = 0,
  max = 999999,
  step = 1,
  presets = [],
}) => {
  const { t } = useTranslation();
  // Local state for fast typing - only syncs to parent on blur
  const [localMin, setLocalMin] = useState<string>(value.min?.toString() ?? "");
  const [localMax, setLocalMax] = useState<string>(value.max?.toString() ?? "");

  // Sync local state when parent value changes (e.g., from URL, clear, or presets)
  useEffect(() => {
    setLocalMin(value.min?.toString() ?? "");
    setLocalMax(value.max?.toString() ?? "");
  }, [value.min, value.max]);

  const handleMinBlur = () => {
    const newValue = localMin === "" ? null : Number(localMin);
    onChange({ ...value, min: newValue });
  };

  const handleMaxBlur = () => {
    const newValue = localMax === "" ? null : Number(localMax);
    onChange({ ...value, max: newValue });
  };

  const handlePresetClick = (preset: { min: number; max: number }) => {
    onChange({ min: preset.min, max: preset.max });
  };

  const localizedUnit = unit ? t(`filters.units.${unit}`, { defaultValue: unit }) : "";

  return (
    <div className="space-y-3">
      {presets.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {presets.map((preset, index) => (
            <Button
              key={index}
              variant="outline"
              size="sm"
              onClick={() => handlePresetClick(preset)}
            >
              {preset.labelKey ? t(preset.labelKey) : preset.label}
            </Button>
          ))}
        </div>
      )}

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-2">
          <Label htmlFor="min-value">
            {t("filters.numberRange.min")} {localizedUnit && `(${localizedUnit})`}
          </Label>
          <Input
            id="min-value"
            type="number"
            placeholder={t("filters.numberRange.minPlaceholder", { unit: localizedUnit || t("filters.numberRange.valueUnit") })}
            value={localMin}
            onChange={(e) => setLocalMin(e.target.value)}
            onBlur={handleMinBlur}
            min={min}
            max={max}
            step={step}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="max-value">
            {t("filters.numberRange.max")} {localizedUnit && `(${localizedUnit})`}
          </Label>
          <Input
            id="max-value"
            type="number"
            placeholder={t("filters.numberRange.maxPlaceholder", { unit: localizedUnit || t("filters.numberRange.valueUnit") })}
            value={localMax}
            onChange={(e) => setLocalMax(e.target.value)}
            onBlur={handleMaxBlur}
            min={min}
            max={max}
            step={step}
          />
        </div>
      </div>

      {error && (
        <p className="text-sm text-red-500 mt-1">{error}</p>
      )}
    </div>
  );
};
