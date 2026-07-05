import { isArgPlaceholder, isOperant, operants } from "./operants";
import { Runtime } from "./runtime";
import type { Expr, StateGetter, StateSetter } from "./types";

function isReference(token: any): token is string {
  if (typeof token !== "string") return false;
  const [prefix] = token.split(":");
  return prefix === "#";
}

function isStateGetter(ref: any): ref is StateGetter {
  return typeof ref == "string" && ref.split(":")[0] === "$";
}

function isStateSetter(ref: any): ref is StateSetter {
  return typeof ref == "string" && ref.split(":")[0] === "$$";
}

export function createCompiler() {
  return (runtime: Runtime): Compiler => {
    // `item` is the current list item (from `$each`). It is captured by closure
    // — like `state` — so `@` resolves to it in both display expressions and
    // deferred event handlers (where the `_` sink would discard a threaded arg).
    return (state: any, item?: any) => {
      function compile(exp: Expr): (p?: any) => any {
        let result: any = (fn: (arg: any) => any) => fn;
        for (const token of exp) {
          if (isOperant(token)) {
            result = result(operants[token]);
            continue;
          }
          if (isArgPlaceholder(token)) {
            result = result(() => item);
            continue;
          }
          if (isReference(token)) {
            const [, name = ""] = token.split(":");
            result = result(() => runtime.resolveReference(name));
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

export type Compiler = (state: any, item?: any) => (expr: Expr) => any;
