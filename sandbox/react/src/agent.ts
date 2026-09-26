import { azure } from "@ai-sdk/azure";
import { tool, stepCountIs, type LanguageModel, type Tool, type ToolSet, type StopCondition } from "ai";
import { applicationDefinition, describeDefinitionFormat } from "@kyte/react";
import { describeCatalog } from "./catalog-manifest";
import * as z from "zod";

export const model: LanguageModel = azure("gpt-5.4");

// Number of steps allowed so the model can fix an invalid definition and add a
// short note after rendering.
export const stopWhen: StopCondition<ToolSet> = stepCountIs(3);

export const SYSTEM_PROMPT = `You are an assistant embedded in a demo chat app. You can answer normally, and you can also render live interactive UI by calling the render_application tool.

Call render_application whenever the user asks you to build, show, generate, or design a UI, component, form, counter, list, etc. For plain questions, just answer in text.

The tool takes a single "definition" argument: a kyte ApplicationDefinition (a JSON object, passed directly — do NOT stringify it).

${describeDefinitionFormat()}

The render_application tool validates your definition. If it returns { "ok": false, "error": ... }, read the error, fix the definition, and call the tool again.

You also have a CATALOG of prebuilt shadcn/ui components. Instantiate them by their capitalized tag name (they follow shadcn/ui's usual composition and props); pass content as nested children. Prefer catalog components over raw HTML for richer UI (Button, Card, Badge, Tabs, Table, Alert, Avatar, etc.). Components that need open/close state or a provider (Dialog, Popover, Tooltip, Sidebar, Chart, Carousel, Toaster, …) may not render standalone — favor static-friendly components unless you wire up the required state/providers.

Available catalog components (by family; notable props shown in parentheses):
${describeCatalog()}

Keep definitions valid JSON. Prefer catalog components; fall back to semantic HTML.`;

// A loose, provider-friendly shape for the tool input. The strict schema is
// recursive/tuple-based, which OpenAI/Azure function-calling rejects — so the
// model emits the definition as native JSON against this loose shape, and we
// verify it strictly in `execute`.
const looseDefinition = z.object({
  state: z.record(z.string(), z.object({ type: z.string(), value: z.any() })),
  render: z.array(z.any()),
  components: z.record(z.string(), z.object({ props: z.any(), render: z.array(z.any()) })).optional(),
});

// The tool verifies the model's definition and returns either the validated
// definition (which the client renders) or an error for the model to fix.
export const renderResult = z.union([
  z.object({ ok: z.literal(true), definition: applicationDefinition }),
  z.object({ ok: z.literal(false), error: z.string() }),
]);

export const renderApplication: Tool = tool({
  description:
    "Render a live interactive UI in the chat for the user. Pass a kyte ApplicationDefinition object in `definition` (native JSON, not a string). Use for any request to build, show, or generate a component/UI. Returns { ok: false, error } if the definition is invalid — fix it and call again.",
  inputSchema: z.object({
    definition: looseDefinition.describe(
      "The ApplicationDefinition object, matching the documented format.",
    ),
  }),
  outputSchema: renderResult,
  execute: async ({ definition }) => {
    // The input is already schema-validated by the SDK; re-check defensively and
    // surface any issue so the model can correct it.
    const result = applicationDefinition.safeParse(definition);
    if (!result.success) {
      const issues = result.error.issues
        .map((issue) => `${issue.path.join(".") || "(root)"}: ${issue.message}`)
        .join("; ");
      return { ok: false as const, error: `Does not match the schema: ${issues}` };
    }

    return { ok: true as const, definition: result.data };
  },
});

export const tools: ToolSet = { render_application: renderApplication };
