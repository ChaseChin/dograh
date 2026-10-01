import type { TFunction } from "i18next";

import type { PropertySpec } from "@/client/types.gen";

// Backend-delivered node-spec text (node display names/descriptions, property
// labels/descriptions/placeholders, option labels) is localized UI-side via
// dictionary maps keyed by stable identifiers (spec name, property name).
// Unknown text falls back to the backend string so node types without a
// mapping (e.g. integration packages) still render (in English).
//
// Key scheme (zh.json / en.json):
//   nodeSpecs.{nodeType}.displayName / .description
//   nodeSpecs.{nodeType}.props.{prop}.label / .description / .placeholder
//   nodeSpecs.{nodeType}.props.{prop}.options.{value}
//   nodeSpecs.{nodeType}.props.{prop}.items.{sub}.label / .description
//   nodeSpecs.common.{prop}.*            — shared by several node types
// Node-specific keys win over `common` keys; both win over the backend text.

// Distinct from any real translation so a missing key is detectable; the
// project i18n init sets `returnEmptyString: false`, so "" would not work.
const MISSING = "__node_spec_server_text_missing__";

function lookup(t: TFunction, key: string): string | undefined {
  const value = (t as (k: string, o?: Record<string, unknown>) => string)(key, {
    defaultValue: MISSING,
  });
  return value === MISSING ? undefined : value;
}

/** Node display name (AddNodePanel, edit-dialog title, integration badge). */
export function nodeSpecDisplayName(
  t: TFunction,
  specName: string,
  backendName: string,
): string {
  return lookup(t, `nodeSpecs.${specName}.displayName`) ?? backendName;
}

/** Node description (AddNodePanel). */
export function nodeSpecDescription(
  t: TFunction,
  specName: string,
  backendText: string,
): string {
  return lookup(t, `nodeSpecs.${specName}.description`) ?? backendText;
}

type TextKind = "label" | "description" | "placeholder";

function propText(
  t: TFunction,
  nodeType: string,
  propName: string,
  kind: TextKind,
  backendText: string,
): string {
  return (
    lookup(t, `nodeSpecs.${nodeType}.props.${propName}.${kind}`) ??
    lookup(t, `nodeSpecs.common.${propName}.${kind}`) ??
    backendText
  );
}

function subPropText(
  t: TFunction,
  nodeType: string,
  propName: string,
  subName: string,
  kind: Exclude<TextKind, "placeholder">,
  backendText: string,
): string {
  return (
    lookup(
      t,
      `nodeSpecs.${nodeType}.props.${propName}.items.${subName}.${kind}`,
    ) ??
    lookup(t, `nodeSpecs.common.${propName}.items.${subName}.${kind}`) ??
    backendText
  );
}

function optionText(
  t: TFunction,
  nodeType: string,
  propName: string,
  subName: string | null,
  value: string | number | boolean,
  backendLabel: string,
): string {
  const v = String(value);
  const specific = subName
    ? `nodeSpecs.${nodeType}.props.${propName}.items.${subName}.options.${v}`
    : `nodeSpecs.${nodeType}.props.${propName}.options.${v}`;
  const shared = subName
    ? `nodeSpecs.common.${propName}.items.${subName}.options.${v}`
    : `nodeSpecs.common.${propName}.options.${v}`;
  return lookup(t, specific) ?? lookup(t, shared) ?? backendLabel;
}

/**
 * Returns a copy of `prop` with user-visible text (display_name, description,
 * placeholder, option labels, and — for fixed_collection rows — sub-property
 * text) localized for `nodeType`. `name` and all non-text fields pass through
 * unchanged, so value seeding/saving by property name is unaffected.
 */
export function localizePropertySpec(
  t: TFunction,
  nodeType: string,
  prop: PropertySpec,
): PropertySpec {
  return {
    ...prop,
    display_name: propText(t, nodeType, prop.name, "label", prop.display_name),
    description: propText(
      t,
      nodeType,
      prop.name,
      "description",
      prop.description,
    ),
    placeholder: prop.placeholder
      ? propText(t, nodeType, prop.name, "placeholder", prop.placeholder)
      : prop.placeholder,
    options: prop.options?.map((o) => ({
      ...o,
      label: optionText(t, nodeType, prop.name, null, o.value, o.label),
    })),
    properties: prop.properties?.map((sub) => ({
      ...sub,
      display_name: subPropText(
        t,
        nodeType,
        prop.name,
        sub.name,
        "label",
        sub.display_name,
      ),
      description: subPropText(
        t,
        nodeType,
        prop.name,
        sub.name,
        "description",
        sub.description,
      ),
      options: sub.options?.map((o) => ({
        ...o,
        label: optionText(
          t,
          nodeType,
          prop.name,
          sub.name,
          o.value,
          o.label,
        ),
      })),
    })),
  };
}
