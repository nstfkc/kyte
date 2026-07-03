const operants = {
  "+": (a: (p: any) => number) => (b: (p: any) => number) => (p: any) => a(p) + b(p),
  pick: (obj: (p: any) => Record<string, any>) => (key: (p: any) => string) => (p: any) =>
    obj(p)[key(p)],
  // Sink: a prefix operant. The extra `() =>` layer is peeled by parse's
  // evaluate-step, so what survives is the handler `(p) => a(p)` — a function
  // that passes the arg through, instead of a collapsed value.
  _: (a: (p: any) => any) => () => (p: any) => a(p),
};

function isOperant(token: any): token is Operant {
  return typeof token === "string" && token in operants;
}

function isArgPlaceholder(token: any): token is ArgPlaceholder {
  return typeof token === "string" && token.startsWith("@");
}

function isReference(token: any): token is string {
  if (typeof token !== "string") return false;
  const [prefix] = token.split(":");
  return prefix === "#";
}

type Operant = keyof typeof operants;
type ArgPlaceholder = "@";
export type Expr = Array<ArgPlaceholder | Operant | number | string | Expr>;

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
