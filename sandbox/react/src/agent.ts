import { azure } from "@ai-sdk/azure";
import { tool, stepCountIs, type LanguageModel, type Tool, type ToolSet, type StopCondition } from "ai";
import { applicationDefinition } from "@kyte/react";
import * as z from "zod";

export const model: LanguageModel = azure("gpt-5.4");

// Number of steps allowed so the model can fix an invalid definition and add a
// short note after rendering.
export const stopWhen: StopCondition<ToolSet> = stepCountIs(3);

export const SYSTEM_PROMPT = `You are an assistant embedded in a demo chat app. You can answer normally, and you can also render live interactive UI by calling the render_application tool.

Call render_application whenever the user asks you to build, show, generate, or design a UI, component, form, counter, list, etc. For plain questions, just answer in text.

The tool takes a single "definition" argument: a kyte ApplicationDefinition (a JSON object, passed directly — do NOT stringify it). Its shape:

{ "state": <State>, "render": <Element[]> }

Element is a 3-tuple: [tag, props, children]
- tag: an HTML tag string ("div", "span", "h1", "p", "ul", "li", "table", "tr", "td", "button", "input", ...).
- props: an object mapping attribute names to Expressions. For an element's text/content, add a "children" prop DIRECTLY in this props object (a sibling of props like "style"). Example cell: ["td", { "style": { "padding": ["8px"] }, "children": ["ORD-1001"] }, []].
- children (3rd item): an array of nested Element tuples ([] if none). A leaf element with only text uses [] here and puts the text in the "children" prop.

Expression is a JSON value in prefix form:
- A literal is wrapped in a single-element array: ["Hello"], [42], [true].
- An operation is [operator, ...args]:
  - Arithmetic: "+", "-", "*", "/", "%"  (e.g. ["+", 1, 2] -> 3; "+" also concatenates strings)
  - Comparison: "==", "!=", ">", "<", ">=", "<="
  - Logic: "and", "or", "not"
  - Conditional: ["if", cond, then, else]
- Read state with the token "$:name" (e.g. ["+", "Count: ", "$:count"]).

State is an object: { "name": { "type": <string>, "value": <initial value> } }. If a UI has no state, use {}. A state value can be an array of objects (e.g. a list of rows).

Lists: to render repeated elements from an array, use the "$each" directive element instead of hand-writing each row:
  ["$each", { "data": <arrayExpr> }, [ <templateElement> ]]
"data" is an expression yielding an array (e.g. ["$:orders"]). The template children are rendered once per item. Inside the template, the current item is ["@"] and a field is ["pick", ["@"], ["fieldName"]].
Example — a table body from state.orders (each { id, customer }):
  ["tbody", {}, [
    ["$each", { "data": ["$:orders"] }, [
      ["tr", {}, [
        ["td", { "children": ["pick", ["@"], ["id"]] }, []],
        ["td", { "children": ["pick", ["@"], ["customer"]] }, []]
      ]]
    ]]
  ]]
Prefer putting list data in state and using "$each" over emitting many near-identical elements.

Event handlers (like "onClick") must be wrapped in the sink operator "_": ["_", <expr>].
To update state, use the postfix setter "$$:name": ["_", [<newValueExpr>, "$$:name"]].

Styling: the "style" prop must be an OBJECT mapping camelCased CSS properties to expressions, NOT a CSS string. Example: "style": { "color": ["red"], "marginTop": ["+", "$:spacing", "px"] }. "style" contains ONLY CSS properties — never put "children" (or other non-CSS props) inside "style". Prefer inline "style" over "className" for appearance.

The render_application tool validates your definition. If it returns { "ok": false, "error": ... }, read the error, fix the definition, and call the tool again.

Full example — an interactive counter:
{
  "state": { "count": { "type": "number", "value": 0 } },
  "render": [
    ["div", {}, [
      ["h2", { "children": ["Counter"] }, []],
      ["span", { "children": ["+", "Count: ", "$:count"] }, []],
      ["button", { "onClick": ["_", [["+", "$:count", 1], "$$:count"]], "children": ["Increment"] }, []]
    ]]
  ]
}

Keep definitions valid JSON. Prefer simple, semantic HTML.`;

// A loose, provider-friendly shape for the tool input. The strict schema is
// recursive/tuple-based, which OpenAI/Azure function-calling rejects — so the
// model emits the definition as native JSON against this loose shape, and we
// verify it strictly in `execute`.
const looseDefinition = z.object({
  state: z.record(z.string(), z.object({ type: z.string(), value: z.any() })),
  render: z.array(z.any()),
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
