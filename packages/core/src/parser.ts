import { isArgPlaceholder, isOperant, isReference, operants } from "./operants";
import type { Expr } from "./types";

export function createParser(references: Record<string, any>) {
  // Every node compiles to a function of the arg `p`. Recursion always goes
  // through here so nested sub-expressions stay arg-propagating.
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
        result = result(() => references[name as any]);
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

  // Uniform: evaluate the top node once. A value expression yields its value; a
  // "_"-wrapped handler yields the inner arg-propagating function.
  return function parse(exp: Expr) {
    return compile(exp)(undefined);
  };
}
