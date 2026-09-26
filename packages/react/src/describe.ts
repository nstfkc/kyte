import { describeExpressions } from "@kyte/core";
import type { Catalog, PropSchema } from "./catalog";

export type DescribeDefinitionFormatOptions = {
  // Global functions the host exposes via `fn:name`, as name -> one-line doc.
  // Omitted (or empty) means the `fn:` token isn't mentioned at all.
  globalFns?: Record<string, string>;
};

// The LLM-facing spec of the ApplicationDefinition format: shape, elements,
// expressions (generated from the operants), state, lists, components, events and
// styling. Task-agnostic — the consumer adds its own instructions and catalog.
export function describeDefinitionFormat(options: DescribeDefinitionFormatOptions = {}): string {
  const globalFns = Object.entries(options.globalFns ?? {});
  const globalFnsSection = globalFns.length
    ? `
Global functions: the token "fn:name" is a host function; call it with "()": ["()", "fn:name", arg]. Available:
${globalFns.map(([name, doc]) => `- fn:${name} — ${doc}`).join("\n")}
`
    : "";

  return `An ApplicationDefinition is a JSON object with these fields, in this order ("components" is optional and comes last):

{ "state": <State>, "render": <Element[]>, "components"?: <Components> }

Element is a 3-tuple: [tag, props, children]
- tag: an HTML tag string ("div", "section", "h1", "p", "a", "img", "button", "input", ...) or a capitalized component name.
- props: an object mapping attribute names to values. An element's text/content goes in a "children" prop DIRECTLY in this object (a sibling of "style"). Example: ["td", { "style": { "padding": "8px" }, "children": "ORD-1001" }, []].
  - A static value is written as plain JSON (PREFERRED): "id": "pricing", "children": "Get started", "disabled": true, "style": { "padding": "40px 0", "display": "flex" }.
  - A dynamic value is an Expression (a JSON array, below): "children": ["+", "Count: ", "$:count"]. Tokens like "$:count" only work inside an Expression array — a plain string is always literal text.
- children (3rd item): an array of nested Element tuples ([] if none). A leaf with only text uses [] here and puts the text in the "children" prop. Always emit all three items.

Expression is a JSON array in prefix form:
- A literal is wrapped in a single-element array: ["Hello"], [42], [true]. A single-element array is always that literal, even an operator symbol: ["/"], ["*"], ["!"] are the text "/", "*", "!". Inside an operation, wrap such text the same way: ["+", "Home ", ["/"]] — a bare "/" there is the operator.
- Join text and values with "+" (any number of parts, left to right): ["+", "© ", "$:year", " Acme. All rights reserved."], ["+", "“", [".", ["#:t"], ["text"]], "”"]. Never list parts without an operator.
- Text that starts with an operator symbol must be a literal inside "+": a "- Name" line is ["+", ["- "], [".", ["#:t"], ["name"]]] — ["-", x] would be subtraction.
- An operation is [operator, ...args]; args are literals or nested expressions. Operators:
${describeExpressions()}
- Tokens:
  - "$:name" reads state (e.g. ["+", "Count: ", "$:count"]).
  - "$$:name" is a postfix state setter: [<newValueExpr>, "$$:name"] (use inside "_").
  - "@" is the current list item inside "$each".
  - "@@" is the event argument inside a handler (e.g. the value an onValueChange passes).
  - "#:name" reads a component prop inside a component's render.
${globalFnsSection}
State is an object: { "name": { "type": <string>, "value": <initial value> } }. Use {} if there is no state. A value can be an array of objects (e.g. rows).

Conditional rendering: render elements only while a condition holds with the "$if" directive:
  ["$if", { "condition": <expr> }, [ <element>, ... ]]
For an else branch, add a second "$if" with the negated condition: ["$if", { "condition": ["!", <expr>] }, [...]].
Example — a badge on the popular plan only: ["$if", { "condition": [".", ["#:plan"], ["popular"]] }, [["Badge", { "children": "Most popular" }, []]]]
Do NOT use "?" to choose between elements — "?" works on values only (e.g. "children": ["?", "$:open", "Hide", "Show"]).

Lists: render repeated elements from an array with the "$each" directive instead of hand-writing each row:
  ["$each", { "data": <arrayExpr> }, [ <templateElement> ]]
"data" yields an array (e.g. ["$:orders"]). The template renders once per item; inside it the item is ["@"] and a field is [".", ["@"], ["fieldName"]].
Example:
  ["ul", {}, [
    ["$each", { "data": ["$:todos"] }, [
      ["li", { "children": [".", ["@"], ["title"]] }, []]
    ]]
  ]]

Reusable components: define them in the top-level "components" object and instantiate them by name.
  "components": { "ComponentName": { "props": { "propName": { "type": <string> } }, "render": <Element[]> } }
"props" may be omitted for a component that takes none.
Instantiate with the name as the tag: ["ComponentName", { "propName": <expr> }, []]. Inside its render, read a prop with "#:propName" (e.g. [".", ["#:order"], ["id"]]).
Component names MUST start with an uppercase letter (lowercase tags are HTML). A component's render sees its props (#:) and global state ($:), but NOT the caller's list item (@) — pass what it needs as props.
Components may reference each other, before they are defined and recursively. A referenced-but-not-yet-defined component renders nothing until its definition appears.
PREFER decomposing the UI into components: keep "render" a thin shell of component references and define them in "components" (which comes last) — the UI then appears progressively as the definition streams in.

Events: handlers ("onClick", "onChange", ...) must be wrapped in the sink "_": ["_", <expr>].
- Set state: ["_", [<newValueExpr>, "$$:name"]], e.g. "onClick": ["_", [["+", "$:count", 1], "$$:count"]].
- Update a nested field: ["_", [[".=", "$:form", ["email"], "@@"], "$$:form"]].

Styling: "style" must be an OBJECT mapping camelCased CSS properties to values, NOT a CSS string: "style": { "color": "red", "marginTop": ["+", "$:spacing", "px"] }. "style" contains ONLY CSS properties — never "children".

Full example — an interactive counter:
{
  "state": { "count": { "type": "number", "value": 0 } },
  "render": [
    ["div", {}, [
      ["h2", { "children": "Counter", "style": { "margin": 0 } }, []],
      ["span", { "children": ["+", "Count: ", "$:count"] }, []],
      ["button", { "onClick": ["_", [["+", "$:count", 1], "$$:count"]], "children": "Increment" }, []]
    ]]
  ]
}

Keep the definition valid JSON.`;
}

function describeProp(name: string, schema: PropSchema): string {
  const type = schema.type === "enum" && schema.options ? schema.options.join("|") : schema.type;
  return schema.description ? `${name}: ${type} (${schema.description})` : `${name}: ${type}`;
}

// A compact, LLM-facing listing of a catalog. Entries with metadata (description,
// props, children) get a line each; bare entries are listed together by name to
// save tokens.
export function describeCatalog(catalog: Catalog): string {
  const detailed: string[] = [];
  const bare: string[] = [];
  for (const [name, entry] of Object.entries(catalog)) {
    const props = Object.entries(entry.props ?? {});
    if (!entry.description && !props.length && entry.children === undefined) {
      bare.push(name);
      continue;
    }
    const parts = [
      entry.description,
      props.length ? `props: ${props.map(([p, s]) => describeProp(p, s)).join(", ")}` : undefined,
      entry.children === true ? "accepts children" : entry.children === false ? "no children" : undefined,
    ].filter(Boolean);
    detailed.push(`- ${name} — ${parts.join("; ")}`);
  }
  if (bare.length) detailed.push(`- Also available: ${bare.join(", ")}`);
  return `Catalog components (instantiate by tag name, e.g. ["Button", { "variant": "outline", "children": "Save" }, []]; nested elements in the 3rd slot become their children):
${detailed.join("\n")}`;
}
