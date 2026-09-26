import { isArgPlaceholder, isOperant, operants, variadicOperants } from "./operants";
import { Runtime } from "./runtime";
import type { Expr, StateGetter, StateSetter } from "./types";

function isReference(token: any): token is string {
  if (typeof token !== "string") return false;
  const [prefix] = token.split(":");
  return prefix === "#";
}

function isGlobalFnRef(token: any): token is string {
  return typeof token === "string" && token.split(":")[0] === "fn";
}

function isStateGetter(ref: any): ref is StateGetter {
  return typeof ref == "string" && ref.split(":")[0] === "$";
}

function isStateSetter(ref: any): ref is StateSetter {
  return typeof ref == "string" && ref.split(":")[0] === "$$";
}

// `["+", a, b, c, ...]` → `["+", ["+", ["+", a, b], c], ...]`: variadic
// operants fold left into their binary form, and a single argument is the
// identity (`["+", x]` → `[x]`). A trailing setter stays postfix.
function unfoldVariadic(exp: Expr): Expr {
  const [head] = exp;
  if (!isOperant(head) || !variadicOperants.has(head)) return exp;
  const setter = isStateSetter(exp[exp.length - 1]) ? exp.slice(-1) : [];
  const args = exp.slice(1, exp.length - setter.length);
  if (args.length === 1) return [args[0]!, ...setter] as Expr;
  if (args.length === 2) return exp;
  const [first, second, ...rest] = args;
  const folded = rest.reduce<Expr>((acc, arg) => [head, acc, arg as any], [head, first!, second!] as Expr);
  return [...folded, ...setter] as Expr;
}

export function createCompiler() {
  return (runtime: Runtime): Compiler => {
    // `item` is the current list item (from `$each`) and `props` are the current
    // component instance's props. Both are captured by closure — like `state` —
    // so `@` and `#:name` resolve in both display expressions and deferred event
    // handlers (where the `_` sink would discard a threaded arg).
    return (state: any, item?: any, props?: any) => {
      function compile(exp: Expr): (p?: any) => any {
        // A lone operator has no arguments to apply to, so `["/"]` is the
        // literal text "/" — a glyph like "/", "*" or "!" stays text.
        if (exp.length === 1 && isOperant(exp[0])) {
          const literal = exp[0];
          return () => literal;
        }
        exp = unfoldVariadic(exp);
        let result: any = (fn: (arg: any) => any) => fn;
        for (const token of exp) {
          if (isOperant(token)) {
            result = result(operants[token]);
            continue;
          }
          if (token === "@@") {
            // The event arg the sink injects at call time — `(p) => p`. Distinct
            // from `@` (item): a handler may need both the row and the event.
            result = result((p: any) => p);
            continue;
          }
          if (isArgPlaceholder(token)) {
            result = result(() => item);
            continue;
          }
          if (isReference(token)) {
            // `#:name` reads a prop passed to the current component instance.
            const [, name = ""] = token.split(":");
            result = result(() => props?.[name]);
            continue;
          }
          if (isGlobalFnRef(token)) {
            // `fn:name` resolves a global function to its value; `()` applies it.
            const [, name = ""] = token.split(":");
            result = result(() => runtime.globalFns[name]);
            continue;
          }
          if (isStateGetter(token)) {
            const [, name = ""] = token.split(":");
            result = result(() => state[name]);
            continue;
          }
          if (isStateSetter(token)) {
            // Postfix: `[<value>, "$$:name"]` sets state[name] to the value
            // accumulated so far. Deferred by `_` so it runs on the event.
            const [, name = ""] = token.split(":");
            const value = result;
            result = (p: any) => runtime.setState(name)(value(p));
            continue;
          }
          if (Array.isArray(token)) {
            result = result(compile(token));
            continue;
          }
          result = result(() => token);
        }
        return result;
      }

      return (exp: Expr) => {
        return compile(exp)();
      };
    };
  };
}

export type Compiler = (state: any, item?: any, props?: any) => (expr: Expr) => any;
