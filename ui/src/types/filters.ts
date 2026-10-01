// Configuration specific to each attribute type
export interface AttributeConfig {
  // For dateRange
  maxRangeDays?: number;
  datePresets?: string[]; // e.g., ["today", "last7days", "last30days"]

  // For multiSelect
  options?: string[]; // Available options to select from
  searchable?: boolean;
  maxSelections?: number;
  showSelectAll?: boolean; // Show select all/none buttons

  // For numberRange
  min?: number;
  max?: number;
  step?: number;
  unit?: string; // e.g., "seconds", "tokens"
  numberPresets?: { label: string; labelKey?: string; min: number; max: number }[];

  // For number (single value)
  placeholder?: string;
  placeholderKey?: string; // i18n key for the placeholder (takes precedence)
  numberSelectLabel?: string;
  numberSelectOptions?: NumberFilterOption[];
  numberSelectOptionsLoading?: boolean;

  // For radio
  radioOptions?: { label: string; labelKey?: string; value: string }[];
  defaultValue?: string;

  // For text
  maxLength?: number;
}

export interface FilterAttribute {
  id: string;
  type: "dateRange" | "multiSelect" | "numberRange" | "number" | "numberSelect" | "radio" | "tags" | "text";
  label: string;
  labelKey?: string; // i18n key for the label (takes precedence over label)
  field?: string; // Database field to filter on (optional, backend will resolve)
  config: AttributeConfig;
}

export interface NumberFilterOption {
  label: string;
  value: number;
}

// Type-safe value types for each filter attribute
export interface DateRangeValue {
  from: Date | null;
  to: Date | null;
}

export interface MultiSelectValue {
  codes: string[];
}

export interface NumberRangeValue {
  min: number | null;
  max: number | null;
}

export interface RadioValue {
  status: string;
}

export interface NumberValue {
  value: number | null;
}

export interface TextValue {
  value: string;
}

export type FilterValue =
  | DateRangeValue
  | MultiSelectValue
  | NumberRangeValue
  | NumberValue
  | RadioValue
  | TextValue;

export interface ActiveFilter {
  attribute: FilterAttribute;
  value: FilterValue;
  isValid: boolean;
}

export interface FilterBuilderState {
  availableAttributes: FilterAttribute[];
  activeFilters: ActiveFilter[];
  isExecuting: boolean;
}

// Filter templates/presets
export interface FilterTemplate {
  id: string;
  name: string;
  nameKey?: string; // i18n key for the name (takes precedence)
  description: string;
  descriptionKey?: string; // i18n key for the description (takes precedence)
  filters: {
    attributeId: string;
    value: FilterValue;
  }[];
}

// Import the workflow filter attributes from the shared lib (used as default)
import { workflowFilterAttributes } from "@/lib/filterAttributes";

// Re-export as availableAttributes for backward compatibility
export const availableAttributes: FilterAttribute[] = workflowFilterAttributes;

// Filter templates
export const filterTemplates: FilterTemplate[] = [
  {
    id: "failed-calls-today",
    name: "Failed Calls Today",
    nameKey: "filters.templatesList.failedCallsToday.name",
    description: "Calls from today with failed disposition codes",
    descriptionKey: "filters.templatesList.failedCallsToday.description",
    filters: [
      {
        attributeId: "dateRange",
        value: {
          from: new Date(new Date().setHours(0, 0, 0, 0)),
          to: new Date(),
        } as DateRangeValue,
      },
      {
        attributeId: "dispositionCode",
        value: {
          codes: ["failed", "no-answer", "busy"],
        } as MultiSelectValue,
      },
    ],
  },
  {
    id: "long-duration-calls",
    name: "Long Duration Calls",
    nameKey: "filters.templatesList.longDurationCalls.name",
    description: "Completed calls longer than 5 minutes",
    descriptionKey: "filters.templatesList.longDurationCalls.description",
    filters: [
      {
        attributeId: "duration",
        value: {
          min: 300,
          max: 86400,
        } as NumberRangeValue,
      },
      {
        attributeId: "status",
        value: {
          status: "completed",
        } as RadioValue,
      },
    ],
  },
  {
    id: "high-cost-calls",
    name: "High Cost Calls",
    nameKey: "filters.templatesList.highCostCalls.name",
    description: "Completed calls using more than 100 tokens",
    descriptionKey: "filters.templatesList.highCostCalls.description",
    filters: [
      {
        attributeId: "tokenUsage",
        value: {
          min: 100,
          max: 10000,
        } as NumberRangeValue,
      },
      {
        attributeId: "status",
        value: {
          status: "completed",
        } as RadioValue,
      },
    ],
  },
  {
    id: "recent-activity",
    name: "Recent Activity",
    nameKey: "filters.templatesList.recentActivity.name",
    description: "All calls from the last 24 hours",
    descriptionKey: "filters.templatesList.recentActivity.description",
    filters: [
      {
        attributeId: "dateRange",
        value: {
          from: new Date(Date.now() - 24 * 60 * 60 * 1000),
          to: new Date(),
        } as DateRangeValue,
      },
    ],
  },
  {
    id: "transferred-calls",
    name: "Transferred Calls",
    nameKey: "filters.templatesList.transferredCalls.name",
    description: "Calls with XFER disposition",
    descriptionKey: "filters.templatesList.transferredCalls.description",
    filters: [
      {
        attributeId: "dispositionCode",
        value: {
          codes: ["XFER"],
        } as MultiSelectValue,
      },
    ],
  },
  {
    id: "active-calls",
    name: "Active Calls",
    nameKey: "filters.templatesList.activeCalls.name",
    description: "Calls currently in progress",
    descriptionKey: "filters.templatesList.activeCalls.description",
    filters: [
      {
        attributeId: "status",
        value: {
          status: "in_progress",
        } as RadioValue,
      },
    ],
  },
];
