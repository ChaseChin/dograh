import { render, screen } from "@testing-library/react";
import { act } from "react";
import { afterEach, describe, expect, it } from "vitest";

import { AuthShell } from "@/components/auth/AuthShell";
import i18n from "@/i18n";

// Renders a real translated component against the REAL i18n instance (no
// mocks): guards that zh is the default UI language and that a runtime
// changeLanguage re-renders translated copy without a page reload.
describe("i18n integration", () => {
  afterEach(async () => {
    await act(() => i18n.changeLanguage("zh"));
  });

  it("defaults to Chinese", () => {
    render(<AuthShell>{null}</AuthShell>);
    expect(i18n.language).toBe("zh");
    expect(
      screen.getByText("VoiceWorker — 为你工作的 AI 语音智能体。"),
    ).toBeTruthy();
    expect(screen.getByText("语音到语音")).toBeTruthy();
    expect(
      screen.getByText("需要私有化部署、数据驻留和数据边界?"),
    ).toBeTruthy();
  });

  it("re-renders in English after changeLanguage without remount", async () => {
    render(<AuthShell>{null}</AuthShell>);
    await act(() => i18n.changeLanguage("en"));
    expect(
      screen.getByText("VoiceWorker — AI voice agents that work for you."),
    ).toBeTruthy();
    expect(screen.getByText("Speech-to-speech")).toBeTruthy();
  });
});
