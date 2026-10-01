import type { TFunction } from "i18next";

import i18n from "@/i18n";
import { formatLocalDateTime } from "@/lib/dateTime";
import { ActiveFilter, DateRangeValue, FilterAttribute, FilterValue, MultiSelectValue, NumberRangeValue, NumberValue, RadioValue, TextValue } from "@/types/filters";

// Get default value based on attribute type
export const getDefaultValue = (type: FilterAttribute["type"]): FilterValue => {
  switch (type) {
    case "dateRange":
      return { from: null, to: null };
    case "multiSelect":
      return { codes: [] };
    case "number":
    case "numberSelect":
      return { value: null };
    case "numberRange":
      return { min: null, max: null };
    case "radio":
      return { status: "all" };
    case "tags":
      return { codes: [] };
    case "text":
      return { value: "" };
    default:
      throw new Error(`Unknown filter type: ${type}`);
  }
};

// URL-decoded filters retain the attribute object used during initialization.
// Resolve it again so asynchronously loaded options are immediately visible.
export const resolveFilterAttributes = (
  filters: ActiveFilter[],
  availableAttributes: FilterAttribute[]
): ActiveFilter[] => filters.map(filter => {
  const currentAttribute = availableAttributes.find(
    attribute => attribute.id === filter.attribute.id
  );
  return currentAttribute && currentAttribute !== filter.attribute
    ? { ...filter, attribute: currentAttribute }
    : filter;
});

// Validate filter based on attribute type. Pass the component's t() so error
// messages follow the active locale; falls back to the i18n singleton.
export const validateFilter = (filter: ActiveFilter, t: TFunction = i18n.t): string | null => {
  switch (filter.attribute.type) {
    case "dateRange": {
      const value = filter.value as DateRangeValue;
      if (!value.from || !value.to) {
        return t("filters.validation.bothDates");
      }
      if (value.to < value.from) {
        return t("filters.validation.endAfterStart");
      }

      // Check max range if configured
      const config = filter.attribute.config;
      if (config.maxRangeDays) {
        const daysDiff = Math.ceil((value.to.getTime() - value.from.getTime()) / (1000 * 60 * 60 * 24));
        if (daysDiff > config.maxRangeDays) {
          return t("filters.validation.maxRange", { days: config.maxRangeDays });
        }
      }
      break;
    }
    case "multiSelect": {
      const value = filter.value as MultiSelectValue;
      if (!value.codes.length) {
        return t("filters.validation.selectOne");
      }

      const config = filter.attribute.config;
      if (config.maxSelections && value.codes.length > config.maxSelections) {
        return t("filters.validation.maxSelections", { max: config.maxSelections });
      }
      break;
    }
    case "numberRange": {
      const value = filter.value as NumberRangeValue;
      if (value.min === null || value.max === null) {
        return t("filters.validation.bothValues");
      }
      if (value.min > value.max) {
        return t("filters.validation.minLessThanMax");
      }

      const config = filter.attribute.config;
      if (config.min !== undefined && value.min < config.min) {
        return t("filters.validation.minNotLess", { min: config.min });
      }
      if (config.max !== undefined && value.max > config.max) {
        return t("filters.validation.maxNotGreater", { max: config.max });
      }
      break;
    }
    case "number": {
      const value = filter.value as NumberValue;
      if (value.value === null) {
        return t("filters.validation.valueRequired");
      }
      const config = filter.attribute.config;
      if (config.min !== undefined && value.value < config.min) {
        return t("filters.validation.valueNotLess", { min: config.min });
      }
      if (config.max !== undefined && value.value > config.max) {
        return t("filters.validation.valueNotGreater", { max: config.max });
      }
      break;
    }
    case "numberSelect": {
      const value = filter.value as NumberValue;
      if (value.value === null) {
        return t("filters.validation.valueRequired");
      }
      break;
    }
    case "radio": {
      const value = filter.value as RadioValue;
      if (!value.status) {
        return t("filters.validation.statusRequired");
      }
      break;
    }
    case "tags": {
      const value = filter.value as MultiSelectValue;
      if (!value.codes.length) {
        return t("filters.validation.tagRequired");
      }
      break;
    }
    case "text": {
      const value = filter.value as TextValue;
      if (!value.value || value.value.trim() === "") {
        return t("filters.validation.textRequired");
      }
      break;
    }
  }
  return null;
};

// Encode filters to URL parameters
export const encodeFiltersToURL = (filters: ActiveFilter[]): string => {
  const params = new URLSearchParams();

  if (filters.length > 0) {
    const filterData = filters.map(filter => ({
      id: filter.attribute.id,
      value: filter.value
    }));
    params.set("filters", JSON.stringify(filterData));
  }

  return params.toString();
};

// Decode filters from URL parameters
export const decodeFiltersFromURL = (
  params: URLSearchParams,
  availableAttributes: FilterAttribute[]
): ActiveFilter[] => {
  const filtersParam = params.get("filters");
  if (!filtersParam) return [];

  try {
    const filterData = JSON.parse(filtersParam) as Array<{
      id: string;
      value: FilterValue;
    }>;

    return filterData.map(item => {
      const attribute = availableAttributes.find(attr => attr.id === item.id);
      if (!attribute) {
        throw new Error(`Unknown filter attribute: ${item.id}`);
      }

      // Convert date strings back to Date objects for dateRange filters
      let value = item.value;
      if (attribute.type === "dateRange" && value) {
        const dateValue = value as { from: string | null; to: string | null };
        value = {
          from: dateValue.from ? new Date(dateValue.from) : null,
          to: dateValue.to ? new Date(dateValue.to) : null,
        };
      }

      const filter: ActiveFilter = {
        attribute,
        value,
        isValid: false
      };

      // Validate the filter
      filter.isValid = validateFilter(filter) === null;

      return filter;
    });
  } catch (error) {
    console.error("Failed to decode filters from URL:", error);
    return [];
  }
};

// Format date range for display
export const formatDateRange = (value: DateRangeValue, t: TFunction = i18n.t): string => {
  if (!value.from || !value.to) return t("filters.summary.noDateRange");

  return t("filters.summary.rangeTo", {
    from: formatLocalDateTime(value.from),
    to: formatLocalDateTime(value.to),
  });
};

// Format number range for display
export const formatNumberRange = (value: NumberRangeValue, unit?: string, t: TFunction = i18n.t): string => {
  if (value.min === null || value.max === null) return t("filters.summary.noRange");

  const localizedUnit = unit ? t(`filters.units.${unit}`, { defaultValue: unit }) : "";
  const unitSuffix = localizedUnit ? ` ${localizedUnit}` : "";
  return `${value.min}${unitSuffix} - ${value.max}${unitSuffix}`;
};

// Get date preset value
export const getDatePresetValue = (preset: string): DateRangeValue => {
  const now = new Date();
  // Start of today (00:00:00.000)
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);
  // End of today (23:59:59.999)
  const todayEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);

  switch (preset) {
    case "today":
      return { from: todayStart, to: todayEnd };
    case "yesterday": {
      const yesterdayStart = new Date(todayStart);
      yesterdayStart.setDate(yesterdayStart.getDate() - 1);
      const yesterdayEnd = new Date(todayStart);
      yesterdayEnd.setMilliseconds(-1); // One millisecond before today start
      return { from: yesterdayStart, to: yesterdayEnd };
    }
    case "last7days": {
      const last7DaysStart = new Date(todayStart);
      last7DaysStart.setDate(last7DaysStart.getDate() - 6); // -6 because today is included
      return { from: last7DaysStart, to: todayEnd };
    }
    case "last30days": {
      const last30DaysStart = new Date(todayStart);
      last30DaysStart.setDate(last30DaysStart.getDate() - 29); // -29 because today is included
      return { from: last30DaysStart, to: todayEnd };
    }
    default:
      return { from: null, to: null };
  }
};
