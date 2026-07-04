import { isArgPlaceholder, isOperant, isReference, operants } from "./operants";
import { Runtime } from "./runtime";
import type { Expr } from "./types";

export function createCompiler(references: Record<string, any>) {
  return (runtime: Runtime): Compiler => {
    function compile(exp: Expr): (p: any) => any {
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
          const [, name] = token.split(":");
          result = result(() => runtime.resolveReference(references[name as any]));
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
      return compile(exp)(undefined);
    };
  };
}

export type Compiler = (expr: Expr) => any;
