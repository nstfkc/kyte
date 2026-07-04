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
  return (runtime: Runtime): ((state: any) => Compiler) => {
    return (state: any) => {
      function compile(exp: Expr): () => any {
        let result: any = (fn: (arg: any) => any) => fn;
        for (const token of exp) {
          if (isOperant(token)) {
            result = result(operants[token]);
            continue;
          }
          if (isArgPlaceholder(token)) {
            result = result((p: any) => p);
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
            const [, name = ""] = token.split(":");
            result = result(() => runtime.setState(name));
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

export type Compiler = (state: any) => (expr: Expr) => any;
