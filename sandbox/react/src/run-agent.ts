/**
 * Runs the chat agent against a prompt, prints the generated ApplicationDefinition
 * and the tool's verification result, then renders it to static HTML to surface
 * any runtime issues.
 *
 * Usage: bun --conditions=development src/run-agent.ts ["prompt"]
 */
import { generateText } from "ai";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { Runtime, Wrapper, applicationDefinition } from "@kyte/react";
import { model, SYSTEM_PROMPT, tools, stopWhen } from "./agent";

const prompt = process.argv[2] ?? "Render a 10 row made up order list";
console.log(`\n=== PROMPT ===\n${prompt}\n`);

const result = await generateText({
  model,
  system: SYSTEM_PROMPT,
  prompt,
  tools,
  stopWhen,
});

let lastDefinition: unknown = null;

result.steps.forEach((step, i) => {
  for (const call of step.toolCalls) {
    const input = call.input as { definition?: unknown };
    console.log(`--- step ${i}: tool call (${call.toolName}) ---`);
    console.log(JSON.stringify(input.definition));
  }
  for (const tr of step.toolResults) {
    const output = tr.output as { ok: boolean; error?: string; definition?: unknown };
    console.log(`--- step ${i}: tool result ---`);
    console.log(output.ok ? "ok: true" : `ok: false — ${output.error}`);
    if (output.ok) lastDefinition = output.definition;
  }
});

if (result.text.trim()) console.log(`\n=== assistant text ===\n${result.text}`);

if (!lastDefinition) {
  console.error("\n❌ No valid definition was produced.");
  process.exit(1);
}

const parsed = applicationDefinition.safeParse(lastDefinition);
if (!parsed.success) {
  console.error("\n❌ Definition failed validation:", parsed.error.issues);
  process.exit(1);
}

try {
  const html = renderToStaticMarkup(
    createElement(Runtime, { children: createElement(Wrapper, { definition: parsed.data }) }),
  );
  console.log(`\n=== rendered HTML ===\n${html}`);
  console.log("\n✅ Rendered without errors.");
} catch (error) {
  console.error("\n❌ RENDER ERROR:\n", error);
  process.exit(1);
}
