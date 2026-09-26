import { isOperant, operantArity, variadicOperants } from "./operants";

export type ExprIssue = { path: number[]; message: string };

// Which context-bound tokens are meaningful where the expression sits. Omitted
// flags aren't checked; `state` (declared names) is only checked when given.
export type ExprScope = {
  item?: boolean; // "@" — inside a $each template
  props?: boolean; // "#:name" — inside a component's render
  handler?: boolean; // "@@" and "$$:name" — inside an event handler ["_", …]
  state?: ReadonlySet<string>;
};

const show = (token: unknown) => JSON.stringify(token);
const isToken = (token: string) => /^(\$\$?|#|fn):/.test(token) || token === "@" || token === "@@";
const DASH_HINT = '; for a dash in text write it as a literal inside "+": ["+", ["- "], <value>]';
const isSetter = (token: unknown): token is string =>
  typeof token === "string" && token.startsWith("$$:");

// Structurally check an expression against what the compiler can run:
// - a single-element array is a literal/token (or a nested expression);
// - otherwise it is [operator, ...args] with exactly the operator's arity,
//   optionally followed by a postfix setter "$$:name", or [value, "$$:name"];
// - args are scalars, tokens or nested arrays — a bare operator can't be an arg.
// Returns issues with paths relative to the expression.
export function validateExpression(expr: unknown, scope: ExprScope = {}): ExprIssue[] {
  const issues: ExprIssue[] = [];
  const report = (path: number[], message: string) => issues.push({ path, message });

  function checkToken(token: unknown, path: number[], handler: boolean) {
    if (Array.isArray(token)) return walk(token, path, handler);
    if (token === null) return report(path, "null isn't allowed in an expression; use a literal");
    if (typeof token === "object") {
      return report(path, "objects aren't allowed inside an expression");
    }
    if (typeof token !== "string") return;
    if (token === "@" && scope.item === false) {
      report(path, '"@" (the list item) only exists inside a $each template; components don\'t see the caller\'s item — pass it as a prop');
    } else if (token === "@@" && scope.handler !== undefined && !handler) {
      report(path, '"@@" (the event argument) only exists inside an event handler ["_", …]');
    } else if (token.startsWith("#:") && scope.props === false) {
      report(path, `"${token}" reads a component prop, but this isn't inside a component's render`);
    } else if (token.startsWith("$:") && scope.state && !scope.state.has(token.slice(2))) {
      report(path, `unknown state "${token.slice(2)}"; declare it in "state"`);
    }
  }

  function walk(exp: unknown[], path: number[], handler: boolean) {
    if (exp.length === 0) return report(path, "empty expression []; a literal is [value]");
    const setterAt = exp.findIndex(isSetter);
    if (setterAt !== -1) {
      const setter = exp[setterAt] as string;
      if (setterAt !== exp.length - 1) {
        return report([...path, setterAt], `"${setter}" must come last: [<value>, "${setter}"]`);
      }
      if (scope.handler !== undefined && !handler) {
        report([...path, setterAt], `"${setter}" sets state, so it only works inside an event handler ["_", …]`);
      }
      if (scope.state && !scope.state.has(setter.slice(3))) {
        report([...path, setterAt], `unknown state "${setter.slice(3)}"; declare it in "state"`);
      }
      if (exp.length === 1) return; // ["$$:name"] sets the state to the event arg
      exp = exp.slice(0, -1);
    }

    const [head, ...args] = exp;
    // A lone operator is literal text (["/"]); any other lone token is a value.
    if (args.length === 0) {
      if (!isOperant(head)) checkToken(head, [...path, 0], handler);
      return;
    }
    if (!isOperant(head)) {
      const hint = Array.isArray(head)
        ? " (a literal is a single-element array, e.g. [\"text\"])"
        : typeof head === "string"
          ? ' — to join text and values write ["+", part1, part2, ...]'
          : "";
      return report([...path, 0], `expected an operator at position 0, got ${show(head)}${hint}`);
    }
    const arity = operantArity[head];
    const variadic = variadicOperants.has(head);
    if (variadic ? args.length < arity : args.length !== arity) {
      const takes = `${arity}${variadic ? " or more" : ""} argument${arity === 1 ? "" : "s"}`;
      const dash = head === "-" && args.length === 1 ? DASH_HINT : "";
      report(path, `"${head}" takes ${takes}, got ${args.length}${dash}`);
    } else if (head === "-" && args.some((arg) => typeof arg === "string" && !isToken(arg))) {
      report(path, `"-" subtracts numbers${DASH_HINT}`);
    }
    const inHandler = handler || head === "_";
    args.forEach((arg, i) => {
      if (isOperant(arg)) {
        report([...path, i + 1], `${show(arg)} is an operator; to use it as text write [${show(arg)}], to apply it nest it: [${show(arg)}, …]`);
      } else {
        checkToken(arg, [...path, i + 1], inHandler);
      }
    });
  }

  if (!Array.isArray(expr)) {
    report([], `expected an expression (a JSON array), got ${show(expr)}`);
  } else {
    walk(expr, [], false);
  }
  return issues;
}
