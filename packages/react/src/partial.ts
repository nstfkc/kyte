import { upgradeDefinition } from "./version";
import type { ApplicationDefinition, ComponentDef, Element, StateExpr } from "./schema";

// Marks a value that was cut off before anything usable arrived (e.g. `tr` of
// `true`, a lone `-`, an object key with no value). Its container drops it.
const INCOMPLETE = Symbol("incomplete");

// Best-effort parse of a JSON prefix, as a model streams it: open strings,
// arrays and objects are closed where the text ends, and values that were cut
// off before becoming meaningful are dropped. Returns undefined if nothing
// usable has arrived yet. Text after the first complete value, or from the
// first malformed spot on, is ignored. Never throws.
export function parsePartialJson(text: string): unknown {
  let i = 0;
  // Whether the last string parsed reached its closing quote.
  let closed = false;

  const skipWs = () => {
    while (i < text.length && /\s/.test(text[i]!)) i++;
  };

  function parseString(): string {
    i++; // opening quote
    closed = false;
    let out = "";
    while (i < text.length) {
      const ch = text[i]!;
      if (ch === '"') {
        i++;
        closed = true;
        return out;
      }
      if (ch === "\\") {
        const next = text[i + 1];
        if (next === undefined) break; // escape cut off
        if (next === "u") {
          const hex = text.slice(i + 2, i + 6);
          if (!/^[0-9a-fA-F]{4}$/.test(hex)) break; // \u escape cut off
          out += String.fromCharCode(parseInt(hex, 16));
          i += 6;
          continue;
        }
        const escapes: Record<string, string> = { n: "\n", t: "\t", r: "\r", b: "\b", f: "\f" };
        out += escapes[next] ?? next;
        i += 2;
        continue;
      }
      out += ch;
      i++;
    }
    i = text.length;
    return out; // unterminated: keep what streamed so far
  }

  function parseValue(): unknown {
    skipWs();
    const ch = text[i];
    if (ch === undefined) return INCOMPLETE;
    if (ch === '"') return parseString();
    if (ch === "[") {
      i++;
      const out: unknown[] = [];
      while (true) {
        skipWs();
        if (i >= text.length) return out;
        if (text[i] === "]") {
          i++;
          return out;
        }
        if (text[i] === ",") {
          i++;
          continue;
        }
        const value = parseValue();
        if (value === INCOMPLETE) return out;
        out.push(value);
      }
    }
    if (ch === "{") {
      i++;
      const out: Record<string, unknown> = {};
      while (true) {
        skipWs();
        if (i >= text.length) return out;
        if (text[i] === "}") {
          i++;
          return out;
        }
        if (text[i] === ",") {
          i++;
          continue;
        }
        if (text[i] !== '"') return stop(out);
        const key = parseString();
        // An unterminated key, or a key whose value hasn't started, is dropped.
        if (!closed) return out;
        skipWs();
        if (text[i] !== ":") return out;
        i++;
        const value = parseValue();
        if (value === INCOMPLETE) return out;
        out[key] = value;
      }
    }
    const literal = /^(?:-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?|true|false|null)/.exec(text.slice(i));
    if (literal) {
      const end = i + literal[0].length;
      // A number touching the end of the text may still be growing, but its
      // prefix is a valid number — keep it.
      i = end;
      return JSON.parse(literal[0]);
    }
    // A cut-off literal (`tru`, `-`, `1.`), or malformed text.
    return stop(INCOMPLETE);
  }

  // Give up on the rest of the text (malformed input): keep what parsed so far.
  function stop<T>(value: T): T {
    i = text.length;
    return value;
  }

  const value = parseValue();
  return value === INCOMPLETE ? undefined : value;
}

const isObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const isValue = (value: unknown) =>
  Array.isArray(value) || ["string", "number", "boolean"].includes(typeof value);

// An attribute is an expression (array) or bare scalar, or an object of them (`style`).
function normalizeAttributes(value: unknown): Element[1] {
  if (!isObject(value)) return {};
  const out: Element[1] = {};
  for (const [key, attr] of Object.entries(value)) {
    if (isValue(attr)) out[key] = attr as any;
    else if (isObject(attr)) {
      out[key] = Object.fromEntries(Object.entries(attr).filter(([, v]) => isValue(v))) as any;
    }
  }
  return out;
}

// Keep elements whose tag and props have arrived. A tuple with only a tag is
// skipped: the tag string itself may still be cut off ("butt" of "button").
function normalizeElements(value: unknown): Element[] {
  if (!Array.isArray(value)) return [];
  const out: Element[] = [];
  for (const element of value) {
    if (!Array.isArray(element) || element.length < 2 || typeof element[0] !== "string") continue;
    const [tag, props, children] = element;
    const attributes = normalizeAttributes(props);
    // A directive whose controlling expression hasn't arrived waits for it.
    if (tag === "$each" && !Array.isArray(attributes.data)) continue;
    if (tag === "$if" && !("condition" in attributes)) continue;
    out.push([tag, attributes, normalizeElements(children)]);
  }
  return out;
}

function normalizeState(value: unknown): StateExpr {
  if (!isObject(value)) return {};
  const out: StateExpr = {};
  for (const [key, entry] of Object.entries(value)) {
    // Wait for the initial value — rendering against `undefined` state would
    // then have to be undone once it arrives.
    if (isObject(entry) && "value" in entry) {
      out[key] = { type: typeof entry.type === "string" ? entry.type : "", value: entry.value };
    }
  }
  return out;
}

function normalizeComponents(value: unknown): Record<string, ComponentDef> {
  if (!isObject(value)) return {};
  const out: Record<string, ComponentDef> = {};
  for (const [name, def] of Object.entries(value)) {
    if (!isObject(def)) continue;
    out[name] = { props: isObject(def.props) ? (def.props as any) : {}, render: normalizeElements(def.render) };
  }
  return out;
}

// Turn a snapshot of a still-streaming definition — raw JSON text, or an object
// from a best-effort partial parse — into a renderable ApplicationDefinition.
// Malformed or incomplete pieces are dropped rather than rejected, and older
// format versions are upgraded (upgradeDefinition). Never throws.
export function parsePartialDefinition(input: unknown): ApplicationDefinition {
  let value = input;
  if (typeof input === "string") {
    // Tolerate prose or a ```json fence before the object.
    const start = input.indexOf("{");
    value = start === -1 ? undefined : parsePartialJson(input.slice(start));
  }
  value = upgradeDefinition(value);
  if (!isObject(value)) return { state: {}, render: [] };
  return {
    ...(typeof value.version === "number" ? { version: value.version } : {}),
    state: normalizeState(value.state),
    render: normalizeElements(value.render),
    components: normalizeComponents(value.components),
  };
}
