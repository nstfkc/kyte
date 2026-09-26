import { isOperant, validateExpression } from "@kyte/core";
import { FORMAT_VERSION } from "./version";

export type DefinitionIssue = { path: (string | number)[]; message: string };

type Scope = { item: boolean; props: boolean };

const isReadToken = (token: unknown) =>
  typeof token === "string" && (token === "@" || token === "@@" || /^(\$|#|fn):/.test(token));

// Whether an `on*` expression can evaluate to a function: a sink ["_", …], a
// forwarded handler (["#:onPress"], state, `.`/`()` results), or "?" choosing
// between such. Arithmetic, comparisons, literals and setters can't — a setter
// outside "_" would even run during render.
function canBeHandler(expr: unknown): boolean {
  if (isReadToken(expr)) return true;
  if (!Array.isArray(expr) || expr.length === 0) return false;
  const [head, ...args] = expr;
  if (args.length === 0) return Array.isArray(head) ? canBeHandler(head) : isReadToken(head);
  if (head === "_" || head === "." || head === "()") return true;
  if (head === "?") return canBeHandler(args[1]) || canBeHandler(args[2]);
  return false;
}

// How to write a token-shaped bare string as the token it was meant to be.
function tokenFix(value: string): string | undefined {
  if (value === "@") return 'to pass the list item write ["@"]';
  if (value === "@@") return 'to use the event argument write ["@@"]';
  const match = /^(\$\$|\$|#|fn):([A-Za-z_][\w-]*)$/.exec(value);
  if (!match) return undefined;
  const [, prefix, name] = match;
  if (prefix === "$") return `to read state write ["${value}"]`;
  if (prefix === "$$") return `to set state use a handler: ["_", [<value>, "${value}"]]`;
  if (prefix === "#") return `to read a component prop write ["${value}"]`;
  return `to call the function write ["()", "fn:${name}", <arg>]`;
}

const DIRECTIVES = new Set(["$each", "$if"]);
const DIRECTIVE_PROPS: Record<string, string> = { $each: "data", $if: "condition" };

const isObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

// Looks like an element tuple (["div", {...}, ...]) rather than an expression:
// a tag followed by a props object (objects never appear in expressions).
const looksLikeElement = (value: unknown) =>
  Array.isArray(value) &&
  typeof value[0] === "string" &&
  !isOperant(value[0]) &&
  isObject(value[1]);

// Check an ApplicationDefinition against everything the renderer relies on,
// with messages that name the likely mistake (for a model to fix and retry).
// `applicationDefinition` reports exactly these issues.
export function validateDefinition(definition: unknown): DefinitionIssue[] {
  const issues: DefinitionIssue[] = [];
  const report = (path: (string | number)[], message: string) => issues.push({ path, message });

  if (!isObject(definition)) {
    report([], 'the definition must be an object: { "state": {...}, "render": [...], "components"?: {...} }');
    return issues;
  }

  const { version } = definition;
  if (version !== undefined) {
    if (typeof version !== "number" || !Number.isInteger(version) || version < 1) {
      report(["version"], `version must be a positive integer (current: ${FORMAT_VERSION})`);
    } else if (version > FORMAT_VERSION) {
      report(["version"], `version ${version} is newer than this kyte supports (${FORMAT_VERSION}); upgrade kyte`);
    } else if (version < FORMAT_VERSION) {
      report(["version"], `version ${version} is outdated (current: ${FORMAT_VERSION}); run upgradeDefinition first`);
    }
  }

  const stateNames = new Set<string>();
  if (!isObject(definition.state)) {
    report(["state"], 'state must be an object: { "name": { "type": <string>, "value": <initial> } } (use {} for none)');
  } else {
    for (const [name, entry] of Object.entries(definition.state)) {
      stateNames.add(name);
      if (!isObject(entry) || typeof entry.type !== "string" || !("value" in entry)) {
        report(["state", name], `state "${name}" must be { "type": <string>, "value": <initial value> }`);
      }
    }
  }

  function checkExpression(expr: unknown[], path: (string | number)[], scope: Scope) {
    const found = validateExpression(expr, { ...scope, handler: false, state: stateNames });
    for (const issue of found) report([...path, ...issue.path], issue.message);
  }

  function checkValue(key: string, value: unknown, path: (string | number)[], scope: Scope) {
    if (value === null) return report(path, `"${key}" is null; omit the prop instead`);
    if (typeof value === "string") return checkBareString(key, value, path);
    if (Array.isArray(value)) {
      if (key === "children" && value.some(looksLikeElement)) {
        return report(path, 'the "children" prop must be text or an expression; put nested elements in the element\'s 3rd slot');
      }
      if (/^on[A-Z]/.test(key) && !canBeHandler(value)) {
        return report(path, `event handler "${key}" must be wrapped in the sink: ["_", <expr>]`);
      }
      return checkExpression(value, path, scope);
    }
    if (isObject(value)) {
      if (key === "children") {
        return report(path, 'the "children" prop must be text or an expression; put nested elements in the element\'s 3rd slot');
      }
      for (const [inner, v] of Object.entries(value)) {
        if (v === null || (typeof v === "object" && !Array.isArray(v))) {
          report([...path, inner], `"${key}.${inner}" must be a plain value or an expression, not ${v === null ? "null" : "an object"}`);
        } else if (Array.isArray(v)) {
          checkExpression(v, [...path, inner], scope);
        } else if (typeof v === "string") {
          checkBareString(`${key}.${inner}`, v, [...path, inner]);
        }
      }
    }
  }

  // A bare string is always literal text, so one that is exactly a token is
  // almost certainly a token written without its array — a silent bug.
  function checkBareString(key: string, value: string, path: (string | number)[]) {
    const fix = tokenFix(value);
    if (fix) report(path, `"${key}": ${JSON.stringify(value)} is the text ${JSON.stringify(value)}; ${fix}`);
  }

  function checkElements(elements: unknown, path: (string | number)[], scope: Scope) {
    if (!Array.isArray(elements)) {
      return report(path, "expected an array of elements [[tag, props, children], ...] ([] for none)");
    }
    elements.forEach((element, i) => checkElement(element, [...path, i], scope));
  }

  function checkElement(element: unknown, path: (string | number)[], scope: Scope) {
    if (!Array.isArray(element)) {
      return report(path, `an element must be an array [tag, props, children], got ${JSON.stringify(element)}`);
    }
    const [tag, props, children] = element;
    if (tag === "?") {
      return report(path, '"?" can\'t choose between elements — use the $if directive: ["$if", { "condition": <expr> }, [...]]');
    }
    if (typeof tag !== "string" || !tag) {
      return report([...path, 0], "an element's first item must be its tag name (a string)");
    }
    if (element.length !== 3) {
      report(path, `an element is exactly 3 items [tag, props, children], got ${element.length}${element.length === 2 ? ' — add [] as the children' : ""}`);
    }
    if (tag.startsWith("$") && !DIRECTIVES.has(tag)) {
      report([...path, 0], `unknown directive "${tag}"; available: $each, $if`);
    }
    if (!isObject(props)) {
      report([...path, 1], "element props must be an object ({} for none)");
    } else {
      const required = DIRECTIVE_PROPS[tag];
      if (required && !(required in props)) {
        report([...path, 1], `${tag} needs a "${required}" expression: ["${tag}", { "${required}": <expr> }, [...]]`);
      } else if (tag === "$each" && !Array.isArray(props.data) && tokenFix(String(props.data)) === undefined) {
        report([...path, 1, "data"], '$each "data" must be an expression yielding an array, e.g. ["$:items"]');
      }
      for (const [key, value] of Object.entries(props)) {
        if (DIRECTIVES.has(key)) {
          report([...path, 1, key], `${key} is a directive element, not a prop: ["${key}", { "${DIRECTIVE_PROPS[key]}": <expr> }, [...]]`);
          continue;
        }
        checkValue(key, value, [...path, 1, key], scope);
      }
    }
    if (element.length >= 3) {
      checkElements(children, [...path, 2], tag === "$each" ? { ...scope, item: true } : scope);
    }
  }

  checkElements(definition.render, ["render"], { item: false, props: false });

  if (definition.components !== undefined) {
    if (!isObject(definition.components)) {
      report(["components"], 'components must be an object: { "Name": { "props"?: {...}, "render": [...] } }');
    } else {
      for (const [name, component] of Object.entries(definition.components)) {
        const path = ["components", name];
        if (!/^[A-Z]/.test(name)) report(path, `component name "${name}" must start with an uppercase letter`);
        if (!isObject(component)) {
          report(path, `component "${name}" must be { "props"?: {...}, "render": [...] }`);
          continue;
        }
        if (component.props !== undefined && !isObject(component.props)) {
          report([...path, "props"], 'component props must be an object: { "propName": { "type": <string> } }');
        }
        checkElements(component.render, [...path, "render"], { item: false, props: true });
      }
    }
  }

  return issues;
}
