import { afterAll, beforeAll, describe, expect, it } from "vitest";

import i18n from "@/i18n";
import {
  checklistStepText,
  telephonyBlockedReason,
  telephonyDisplayName,
  telephonyFieldText,
  telephonyOptionText,
  telephonySectionText,
} from "./telephonyServerText";

describe("telephonyServerText sanity", () => {
  beforeAll(() => i18n.changeLanguage("zh"));
  afterAll(() => i18n.changeLanguage("en"));

  const t = i18n.t.bind(i18n);

  it("maps shared caller_id step with provider name interpolation", () => {
    const step = {
      key: "caller_id",
      title: "Add a phone number to use as caller ID",
      description:
        "Outbound calls need a number to dial from. Add at least one number from your Twilio account under Phone numbers below.",
    };
    expect(checklistStepText(t, step, "title", "twilio")).toBe(
      "添加一个用作主叫号码的电话号码",
    );
    expect(checklistStepText(t, step, "description", "twilio")).toContain(
      "Twilio",
    );
    expect(checklistStepText(t, step, "description", "twilio")).not.toContain(
      "Outbound calls",
    );
  });

  it("disambiguates cloudonix sip_domain variants", () => {
    const managed = {
      key: "sip_domain",
      title: "SIP domain provisioned",
      description:
        "Dograh provisioned a Cloudonix SIP domain for this organization. Its inbound hostname and outbound origin IP are listed under SIP connectivity below — you will need them when configuring your carrier.",
    };
    const selfServe = {
      key: "sip_domain",
      title: "Cloudonix credentials saved",
      description:
        "Your Cloudonix bearer token and domain are stored and used for every call on this configuration.",
    };
    expect(checklistStepText(t, managed, "title", "cloudonix")).toBe(
      "SIP 域名已开通",
    );
    expect(checklistStepText(t, selfServe, "title", "cloudonix")).toBe(
      "Cloudonix 凭证已保存",
    );
    expect(checklistStepText(t, selfServe, "description", "cloudonix")).toBe(
      "你的 Cloudonix Bearer 令牌和域名已保存,并将用于此配置上的每一次呼叫。",
    );
  });

  it("maps cloudonix caller_id description variant, not the shared one", () => {
    const step = {
      key: "caller_id",
      title: "Add a phone number to use as caller ID",
      description:
        "Add at least one number your carrier delivers to you. Cloudonix requires a caller ID on every outbound call and rejects the call without one.",
    };
    expect(checklistStepText(t, step, "description", "cloudonix")).toContain(
      "Cloudonix 要求每次外呼",
    );
  });

  it("maps blocked reasons from bare strings", () => {
    expect(
      telephonyBlockedReason(
        t,
        "Outbound calls need a number to dial from. Add at least one number from your Telnyx account under Phone numbers below.",
        "telnyx",
      ),
    ).toContain("Telnyx");
    expect(telephonyBlockedReason(t, "some unknown reason", "twilio")).toBe(
      "some unknown reason",
    );
    expect(
      telephonyBlockedReason(
        t,
        "Under Outbound trunks, add a trunk pointing at your SIP carrier or PBX and allow its origin IP on your side. Without one Dograh has nowhere to send outbound calls.",
        "cloudonix",
      ),
    ).toContain("外呼中继");
  });

  it("maps field labels/descriptions with provider-specific over common", () => {
    // common label
    expect(telephonyFieldText(t, "twilio", "api_key", "label", "API Key")).toBe(
      "API 密钥",
    );
    // provider-specific label beats common
    expect(
      telephonyFieldText(t, "ari", "from_numbers", "label", "Phone Numbers"),
    ).toBe("呼出分机");
    // common label when no provider-specific key
    expect(
      telephonyFieldText(t, "twilio", "from_numbers", "label", "Phone Numbers"),
    ).toBe("电话号码");
    // dotted field name
    expect(
      telephonyFieldText(
        t,
        "ari",
        "external_pbx.agent_api.username",
        "label",
        "Agent API User",
      ),
    ).toBe("坐席 API 用户");
    // unknown field falls back
    expect(
      telephonyFieldText(t, "twilio", "nope", "label", "Whatever"),
    ).toBe("Whatever");
    // description
    expect(
      telephonyFieldText(
        t,
        "twilio",
        "account_sid",
        "description",
        "Twilio Account SID (starts with AC)",
      ),
    ).toBe("Twilio 账户 SID(以 AC 开头)");
  });

  it("maps sections, options and display names with fallback", () => {
    expect(telephonySectionText(t, "ari", "External PBX")).toBe("外部 PBX");
    expect(telephonySectionText(t, "twilio", "Nope")).toBe("Nope");
    expect(
      telephonyOptionText(t, "ari", "external_pbx.type", "vicidial", "VICIdial"),
    ).toBe("VICIdial");
    expect(telephonyDisplayName(t, "twilio", "Twilio")).toBe("Twilio");
  });

  it("returns backend text when English source drifts", () => {
    const step = {
      key: "trunk_assignment",
      title: "Changed backend title",
      description: "Changed backend description",
    };
    expect(checklistStepText(t, step, "title", "cloudonix")).toBe(
      "Changed backend title",
    );
  });
});

describe("telephonyServerText in en locale", () => {
  beforeAll(() => i18n.changeLanguage("en"));

  const t = i18n.t.bind(i18n);

  it("en values equal backend source verbatim", () => {
    const step = {
      key: "outbound_trunk",
      title: "Connect your SIP carrier for outbound calls",
      description:
        "Optional: add a trunk under Outbound trunks to pin Dograh's calls to one route. Without it Cloudonix picks among the active trunks on your domain.",
    };
    expect(checklistStepText(t, step, "description", "cloudonix")).toBe(
      step.description,
    );
    expect(
      telephonyFieldText(
        t,
        "ari",
        "dial_string_template",
        "description",
        "How a dialed number reaches your trunk. {number} is replaced with the number being called. Use PJSIP/{number}@my-trunk to dial a trunk directly, or Local/{number}@from-internal to let your dialplan's outbound routes choose one. Leave as PJSIP/{number} when your endpoints are named after the extensions you dial.",
      ),
    ).toBe(
      "How a dialed number reaches your trunk. {number} is replaced with the number being called. Use PJSIP/{number}@my-trunk to dial a trunk directly, or Local/{number}@from-internal to let your dialplan's outbound routes choose one. Leave as PJSIP/{number} when your endpoints are named after the extensions you dial.",
    );
  });
});
