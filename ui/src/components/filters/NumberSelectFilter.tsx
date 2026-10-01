import { useTranslation } from "react-i18next";

import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { NumberFilterOption, NumberValue } from "@/types/filters";

interface NumberSelectFilterProps {
  value: NumberValue;
  onChange: (value: NumberValue) => void;
  error?: string;
  label?: string;
  placeholder?: string;
  options: NumberFilterOption[];
  isLoading?: boolean;
}

export const NumberSelectFilter: React.FC<NumberSelectFilterProps> = ({
  value,
  onChange,
  error,
  label,
  placeholder,
  options,
  isLoading = false,
}) => {
  const { t } = useTranslation();
  const selectedOptionExists = options.some(option => option.value === value.value);
  const unavailableSelection =
    value.value !== null && !selectedOptionExists
      ? { label: t("filters.numberSelect.unavailable", { id: value.value }), value: value.value }
      : null;

  return (
    <div className="space-y-2">
      <div className="space-y-2">
        <Label>{label ?? t("filters.numberSelect.option")}</Label>
        <Select
          value={value.value === null ? "" : value.value.toString()}
          onValueChange={(selectedValue) => {
            const numericValue = parseInt(selectedValue, 10);
            onChange({ value: Number.isNaN(numericValue) ? null : numericValue });
          }}
          disabled={isLoading || options.length === 0}
        >
          <SelectTrigger className={error ? "border-red-500" : ""}>
            <SelectValue placeholder={isLoading ? t("filters.numberSelect.loading") : (placeholder ?? t("filters.numberSelect.placeholder"))} />
          </SelectTrigger>
          <SelectContent>
            {unavailableSelection && (
              <SelectItem value={unavailableSelection.value.toString()} disabled>
                {unavailableSelection.label}
              </SelectItem>
            )}
            {options.length === 0 ? (
              <div className="px-2 py-1.5 text-sm text-muted-foreground">
                {t("filters.numberSelect.empty")}
              </div>
            ) : (
              options.map((option) => (
                <SelectItem key={option.value} value={option.value.toString()}>
                  {option.label}
                </SelectItem>
              ))
            )}
          </SelectContent>
        </Select>
      </div>
      {error && <p className="text-xs text-red-500">{error}</p>}
    </div>
  );
};
