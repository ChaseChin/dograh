import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import type { ReactNode } from "react";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import i18n from "@/i18n";

import { CreateWorkflowButton } from "./CreateWorkflowButton";

// The assertions below match the en.json copy.
beforeAll(async () => {
  await i18n.changeLanguage("en");
});

const mocks = vi.hoisted(() => ({
  create: vi.fn(),
  push: vi.fn(),
}));

vi.mock("@/client/sdk.gen", () => ({
  createWorkflowApiV1WorkflowCreateDefinitionPost: mocks.create,
}));

vi.mock("@/lib/auth", () => ({
  useAuth: () => ({
    user: { id: 1 },
    loading: false,
    getAccessToken: async () => "token",
  }),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: mocks.push }),
}));

// Radix primitives need real layout, so the tests drive plain stand-ins.
vi.mock("@/components/ui/dropdown-menu", () => ({
  DropdownMenu: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  DropdownMenuTrigger: ({ children }: { children: ReactNode }) => <>{children}</>,
  DropdownMenuContent: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  DropdownMenuItem: ({ children, onClick }: { children: ReactNode; onClick?: () => void }) => (
    <button onClick={onClick}>{children}</button>
  ),
}));

vi.mock("@/components/ui/dialog", () => ({
  Dialog: ({ open, children }: { open: boolean; children: ReactNode }) =>
    open ? <div data-testid="dialog">{children}</div> : null,
  DialogContent: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  DialogDescription: ({ children }: { children: ReactNode }) => <p>{children}</p>,
  DialogFooter: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  DialogHeader: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  DialogTitle: ({ children }: { children: ReactNode }) => <h2>{children}</h2>,
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

function openBlankCanvasDialog() {
  render(<CreateWorkflowButton />);
  fireEvent.click(screen.getByText("Blank Canvas"));
  return screen.getByTestId("dialog");
}

function submittedBody() {
  return mocks.create.mock.calls[0][0].body;
}

describe("CreateWorkflowButton blank canvas", () => {
  beforeEach(() => {
    mocks.create.mockReset();
    mocks.push.mockReset();
    mocks.create.mockResolvedValue({ data: { id: 42 } });
  });

  it("asks for the agent language before creating anything", () => {
    const dialog = openBlankCanvasDialog();

    expect(within(dialog).getByText("Choose the agent language")).toBeTruthy();
    expect(within(dialog).getByTestId("language-select")).toHaveProperty("value", "zh");
    expect(mocks.create).not.toHaveBeenCalled();
  });

  it("defaults to Chinese and ships a Chinese opening prompt", async () => {
    const dialog = openBlankCanvasDialog();

    fireEvent.click(within(dialog).getByRole("button", { name: "Blank Canvas" }));

    await waitFor(() => expect(mocks.push).toHaveBeenCalledWith("/workflow/42"));
    const body = submittedBody();
    expect(body.language).toBe("zh");
    expect(body.workflow_definition.nodes[0].data.prompt).toContain(
      "- Language: 始终使用简体中文与对方交流,即使对方使用其他语言,也用中文回应。",
    );
  });

  it("sends the picked language and its prompt when the user changes it", async () => {
    const dialog = openBlankCanvasDialog();

    fireEvent.change(within(dialog).getByTestId("language-select"), {
      target: { value: "en" },
    });
    // Picking a non-Chinese language warns that the speech engines are unchanged.
    expect(within(dialog).getByText(/text-to-speech and speech recognition/)).toBeTruthy();

    fireEvent.click(within(dialog).getByRole("button", { name: "Blank Canvas" }));

    await waitFor(() => expect(mocks.push).toHaveBeenCalledWith("/workflow/42"));
    const body = submittedBody();
    expect(body.language).toBe("en");
    const prompt = body.workflow_definition.nodes[0].data.prompt;
    expect(prompt).toContain(
      "- Language: Always respond in English, regardless of the language the caller uses.",
    );
    expect(prompt).not.toContain("UK English");
  });

  it("creates nothing when the dialog is cancelled", () => {
    const dialog = openBlankCanvasDialog();

    fireEvent.click(within(dialog).getByRole("button", { name: "Cancel" }));

    expect(mocks.create).not.toHaveBeenCalled();
    expect(screen.queryByTestId("dialog")).toBeNull();
  });
});