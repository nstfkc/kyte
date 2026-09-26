import type { Operant } from "./operants";

// LLM-facing docs for every operant. Typed as `Record<Operant, ...>` so adding
// an operant without documenting it is a type error — the prompt can't drift.
export const operantDocs: Record<Operant, { group: string; doc: string }> = {
  "+": {
    group: "Arithmetic",
    doc: '["+", a, b, ...] adds numbers or joins text, 1 or more args left to right (["+", x] is just x): ["+", "© ", "$:year", " Acme"]',
  },
  "-": { group: "Arithmetic", doc: '["-", a, b]' },
  "*": { group: "Arithmetic", doc: '["*", a, b]' },
  "/": { group: "Arithmetic", doc: '["/", a, b]' },
  "%": { group: "Arithmetic", doc: '["%", a, b]' },
  "==": { group: "Comparison", doc: '["==", a, b] (strict equality)' },
  "!=": { group: "Comparison", doc: '["!=", a, b]' },
  ">": { group: "Comparison", doc: '[">", a, b]' },
  "<": { group: "Comparison", doc: '["<", a, b]' },
  ">=": { group: "Comparison", doc: '[">=", a, b]' },
  "<=": { group: "Comparison", doc: '["<=", a, b]' },
  "&&": { group: "Logic", doc: '["&&", a, b] (short-circuits)' },
  "||": { group: "Logic", doc: '["||", a, b] (short-circuits)' },
  "!": { group: "Logic", doc: '["!", a]' },
  "?": { group: "Conditional", doc: '["?", cond, then, else] (only the taken branch runs)' },
  ".": { group: "Member access", doc: '[".", obj, ["key"]] reads obj.key' },
  ".=": {
    group: "Member assign",
    doc: '[".=", obj, ["a.b"], value] returns a COPY of obj with the dot-path a.b set to value (array indices allowed, e.g. ["items.0.done"])',
  },
  "()": {
    group: "Function call",
    doc: '["()", fn, arg] applies a function to one argument; multi-arg functions are curried: ["()", ["()", fn, a], b]',
  },
  _: {
    group: "Event handler",
    doc: '["_", expr] wraps an event handler (onClick, onChange, ...); expr runs when the event fires',
  },
};

// A compact description of the expression language, generated from `operantDocs`.
export function describeExpressions(): string {
  const groups = new Map<string, string[]>();
  for (const { group, doc } of Object.values(operantDocs)) {
    groups.set(group, [...(groups.get(group) ?? []), doc]);
  }
  return [...groups].map(([group, docs]) => `- ${group}: ${docs.join("; ")}`).join("\n");
}
