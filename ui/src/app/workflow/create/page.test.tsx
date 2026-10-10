import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import i18n from "@/i18n";

import CreateWorkflowPage from "./page";

// The assertions below match the en.json copy.
beforeAll(async () => {
  await i18n.changeLanguage("en");
});

const mocks = vi.hoisted(() => ({
  createFromTemplate: vi.fn(),
}));

vi.mock("@/client/sdk.gen", () => ({
  createWorkflowFromTemplateApiV1WorkflowCreateTemplatePost: mocks.createFromTemplate,
}));

vi.mock("@/lib/auth", () => ({
  useAuth: () => ({
    user: { id: 1 },
    loading: false,
    getAccessToken: async () => "token",
  }),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn() }),
}));

vi.mock("@/components/ui/select", () => ({
  Select: ({
    value,
    onValueChange,
    children,
  }: {
    value: string;
    onValueChange: (value: string) => void;
    children: ReactNode;
  }) => (
    <select
      data-testid="language-select"
      value={value}
      onChange={(event) => onValueChange(event.target.value)}
    >
      {children}
    </select>
  ),
  SelectTrigger: ({ children }: { children: ReactNode }) => <>{children}</>,
  SelectValue: () => null,
  SelectContent: ({ children }: { children: ReactNode }) => <>{children}</>,
  SelectItem: ({ value, children }: { value: string; children: ReactNode }) => (
    <option value={value}>{children}</option>
  ),
}));

// The page renders one select per choice; the language one is the only select
// offering "auto".
function languageSelect(): HTMLSelectElement {
  const select = screen
    .getAllByTestId("language-select")
    .find((element) =>
      Array.from((element as HTMLSelectElement).options).some((option) => option.value === "auto"),
    );
  if (!select) throw new Error("language select not found");
  return select as HTMLSelectElement;
}

function renderFilledForm() {
  render(<CreateWorkflowPage />);

  fireEvent.change(screen.getByPlaceholderText(/Lead Qualification/), {
    target: { value: "Support" },
  });
  fireEvent.change(screen.getByPlaceholderText(/Describe briefly/), {
    target: { value: "Answer billing questions" },
  });
}

function submit() {
  fireEvent.click(screen.getByRole("button", { name: "Create Agent" }));
}

describe("Agent Builder create page", () => {
  beforeEach(() => {
    mocks.createFromTemplate.mockReset();
    mocks.createFromTemplate.mockResolvedValue({ data: { id: 7 } });
  });

  it("defaults the agent language to Chinese", async () => {
    renderFilledForm();
    submit();

    await waitFor(() => expect(mocks.createFromTemplate).toHaveBeenCalled());
    expect(languageSelect()).toHaveProperty("value", "zh");
    expect(mocks.createFromTemplate.mock.calls[0][0].body.language).toBe("zh");
  });

  it("submits the language the user picked", async () => {
    renderFilledForm();
    fireEvent.change(languageSelect(), { target: { value: "auto" } });
    // Picking a non-Chinese language warns that the speech engines are unchanged.
    expect(screen.getByText(/text-to-speech and speech recognition/)).toBeTruthy();
    submit();

    await waitFor(() => expect(mocks.createFromTemplate).toHaveBeenCalled());
    expect(mocks.createFromTemplate.mock.calls[0][0].body.language).toBe("auto");
  });
});