import { useTranslation } from "react-i18next";

import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { RadioValue } from "@/types/filters";

interface RadioFilterProps {
  value: RadioValue;
  onChange: (value: RadioValue) => void;
  error?: string;
  options: { label: string; labelKey?: string; value: string }[];
  // Heading above the options. Defaults to the completion-status wording this
  // filter originally served.
  label?: string;
}

export const RadioFilter: React.FC<RadioFilterProps> = ({
  value,
  onChange,
  error,
  options,
  label,
}) => {
  const { t } = useTranslation();

  const handleChange = (newValue: string) => {
    onChange({ status: newValue });
  };

  return (
    <div className="space-y-3">
      <Label>{label ?? t("filters.radio.defaultLabel")}</Label>
      <RadioGroup value={value.status} onValueChange={handleChange}>
        {options.map((option) => (
          <div key={option.value} className="flex items-center space-x-2">
            <RadioGroupItem value={option.value} id={option.value} />
            <Label htmlFor={option.value} className="font-normal cursor-pointer">
              {option.labelKey ? t(option.labelKey) : option.label}
            </Label>
          </div>
        ))}
      </RadioGroup>

      {error && (
        <p className="text-sm text-red-500 mt-1">{error}</p>
      )}
    </div>
  );
};
