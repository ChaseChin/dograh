import { FilterAttribute } from "@/types/filters";

// Shared filter attribute definitions. Every user-facing string carries an
// i18n key alongside the English default: labelKey (attribute label),
// config.placeholderKey (input placeholder), labelKey on radio/preset options.
// Render with t(labelKey) falling back to the English label.
export const baseFilterAttributes: Record<string, Omit<FilterAttribute, "id">> = {
  dateRange: {
    type: "dateRange",
    label: "Date and Time Range",
    labelKey: "filters.attributes.dateRange",
    config: {
      maxRangeDays: 30,
      datePresets: ["today", "yesterday", "last7days", "last30days"],
    },
  },
  dispositionCode: {
    type: "multiSelect",
    label: "Disposition Code",
    labelKey: "filters.attributes.dispositionCode",
    config: {
      // Populated at runtime from the backend catalog — see
      // useDispositionCodes. Left empty here so no screen can ship a stale
      // copy of the list.
      options: [],
      searchable: true,
      showSelectAll: true,
    },
  },
  duration: {
    type: "numberRange",
    label: "Call Duration",
    labelKey: "filters.attributes.duration",
    config: {
      min: 0,
      max: 86400,
      step: 1,
      unit: "seconds",
      numberPresets: [
        { label: "< 1 min", labelKey: "filters.presets.under1min", min: 0, max: 60 },
        { label: "1-5 min", labelKey: "filters.presets.1to5min", min: 60, max: 300 },
        { label: "> 5 min", labelKey: "filters.presets.over5min", min: 300, max: 86400 },
      ],
    },
  },
  status: {
    type: "radio",
    label: "Completion Status",
    labelKey: "filters.attributes.status",
    config: {
      radioOptions: [
        { label: "Completed", labelKey: "filters.options.status.completed", value: "completed" },
        { label: "In Progress", labelKey: "filters.options.status.in_progress", value: "in_progress" },
        { label: "All", labelKey: "filters.options.status.all", value: "all" },
      ],
      defaultValue: "all",
    },
  },
  callTags: {
    type: "tags",
    label: "Tags",
    labelKey: "filters.attributes.callTags",
    config: {
      placeholder: "Enter tags",
      placeholderKey: "filters.attributePlaceholders.callTags",
    },
  },
  tokenUsage: {
    type: "numberRange",
    label: "Token Usage",
    labelKey: "filters.attributes.tokenUsage",
    config: {
      min: 0,
      max: 10000,
      step: 0.01,
      unit: "tokens",
    },
  },
  runId: {
    type: "number",
    label: "Workflow Run ID",
    labelKey: "filters.attributes.runId",
    config: {
      placeholder: "Enter run ID",
      placeholderKey: "filters.attributePlaceholders.runId",
      min: 1,
      max: 9999999,
      step: 1,
    },
  },
  workflowId: {
    type: "number",
    label: "Workflow ID",
    labelKey: "filters.attributes.workflowId",
    config: {
      placeholder: "Enter workflow ID",
      placeholderKey: "filters.attributePlaceholders.workflowId",
      min: 1,
      max: 999999,
      step: 1,
    },
  },
  callerNumber: {
    type: "text",
    label: "Caller Number",
    labelKey: "filters.attributes.callerNumber",
    config: {
      placeholder: "Enter caller number (partial match)",
      placeholderKey: "filters.attributePlaceholders.callerNumber",
      maxLength: 20,
    },
  },
  calledNumber: {
    type: "text",
    label: "Called Number",
    labelKey: "filters.attributes.calledNumber",
    config: {
      placeholder: "Enter called number (partial match)",
      placeholderKey: "filters.attributePlaceholders.calledNumber",
      maxLength: 20,
    },
  },
  callDirection: {
    type: "radio",
    label: "Direction",
    labelKey: "filters.attributes.callDirection",
    config: {
      radioOptions: [
        { label: "Inbound", labelKey: "filters.options.callDirection.inbound", value: "inbound" },
        { label: "Outbound", labelKey: "filters.options.callDirection.outbound", value: "outbound" },
        { label: "All", labelKey: "filters.options.callDirection.all", value: "all" },
      ],
      defaultValue: "all",
    },
  },
  callChannel: {
    type: "radio",
    label: "Type",
    labelKey: "filters.attributes.callChannel",
    config: {
      radioOptions: [
        { label: "Telephony", labelKey: "filters.options.callChannel.telephony", value: "telephony" },
        { label: "Web call", labelKey: "filters.options.callChannel.web", value: "web" },
        { label: "Text chat", labelKey: "filters.options.callChannel.chat", value: "chat" },
        { label: "All", labelKey: "filters.options.callChannel.all", value: "all" },
      ],
      defaultValue: "all",
    },
  },
  campaignId: {
    type: "number",
    label: "Campaign ID",
    labelKey: "filters.attributes.campaignId",
    config: {
      placeholder: "Enter campaign ID",
      placeholderKey: "filters.attributePlaceholders.campaignId",
      min: 1,
      max: 9999999,
      step: 1,
    },
  },
};

// Helper function to create filter attributes with proper IDs
export function createFilterAttributes(
  attributeKeys: string[],
  overrides?: Record<string, Partial<Omit<FilterAttribute, "id">>>
): FilterAttribute[] {
  return attributeKeys.map((key) => {
    const baseAttr = baseFilterAttributes[key];
    if (!baseAttr) {
      throw new Error(`Unknown filter attribute key: ${key}`);
    }

    const override = overrides?.[key] || {};

    return {
      id: key,
      ...baseAttr,
      ...override,
      config: {
        ...baseAttr.config,
        ...(override.config || {}),
      },
    };
  });
}

export function withDispositionCodeOptions(
  attributes: FilterAttribute[],
  options: string[]
): FilterAttribute[] {
  return attributes.map(attribute => (
    attribute.id === "dispositionCode"
      ? {
          ...attribute,
          config: {
            ...attribute.config,
            options,
          },
        }
      : attribute
  ));
}

// Default workflow filter attributes
export const workflowFilterAttributes = createFilterAttributes([
  "dateRange",
  "dispositionCode",
  "duration",
  "status",
  "tokenUsage",
]);

// Superadmin filter attributes (includes additional fields)
export const superadminFilterAttributes = createFilterAttributes([
  "dateRange",
  "runId",
  "workflowId",
  "callerNumber",
  "calledNumber",
  "dispositionCode",
  "status",
  "duration",
  "tokenUsage",
  "callTags",
]);

// Usage page filter attributes (simplified for regular users)
export const usageFilterAttributes = createFilterAttributes(
  [
    "dateRange",
    "duration",
    "dispositionCode",
    "callDirection",
    "callChannel",
    "callerNumber",
    "calledNumber",
    "runId",
    "workflowId",
    "campaignId",
  ],
  {
    runId: {
      label: "Run ID",
      labelKey: "filters.attributes.usageRunId",
    },
    workflowId: {
      label: "Agent ID",
      labelKey: "filters.attributes.usageWorkflowId",
    },
    dateRange: {
      label: "Date Range",
      labelKey: "filters.attributes.usageDateRange",
      config: {
        maxRangeDays: 90,
        datePresets: ["today", "yesterday", "last7days", "last30days"],
      },
    },
    dispositionCode: {
      label: "Disposition",
      labelKey: "filters.attributes.usageDisposition",
      config: {
        searchable: true,
        showSelectAll: true,
      },
    },
    duration: {
      label: "Duration",
      labelKey: "filters.attributes.usageDuration",
      config: {
        min: 0,
        max: 3600, // Up to 1 hour
        step: 1,
        unit: "seconds",
        numberPresets: [
          { label: "< 30 sec", labelKey: "filters.presets.under30sec", min: 0, max: 30 },
          { label: "30 sec - 1 min", labelKey: "filters.presets.30secTo1min", min: 30, max: 60 },
          { label: "1-3 min", labelKey: "filters.presets.1to3min", min: 60, max: 180 },
          { label: "3-5 min", labelKey: "filters.presets.3to5min", min: 180, max: 300 },
          { label: "> 5 min", labelKey: "filters.presets.over5min", min: 300, max: 3600 },
        ],
      },
    },
  }
);
