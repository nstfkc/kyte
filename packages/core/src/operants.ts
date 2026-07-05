import type { ArgPlaceholder } from "./types";

// Each operant is curried: it consumes exactly as many following tokens as its
// arity (each already compiled to `(p) => value`), then returns `(p) => result`.
export const operants = {
  // Arithmetic (binary). `+` also concatenates strings, matching JS `+`.
  "+": (a: (p: any) => any) => (b: (p: any) => any) => (p: any) => a(p) + b(p),
  "-": (a: (p: any) => number) => (b: (p: any) => number) => (p: any) => a(p) - b(p),
  "*": (a: (p: any) => number) => (b: (p: any) => number) => (p: any) => a(p) * b(p),
  "/": (a: (p: any) => number) => (b: (p: any) => number) => (p: any) => a(p) / b(p),
  "%": (a: (p: any) => number) => (b: (p: any) => number) => (p: any) => a(p) % b(p),

  // Comparison (binary). Equality is strict (=== / !==).
  "==": (a: (p: any) => any) => (b: (p: any) => any) => (p: any) => a(p) === b(p),
  "!=": (a: (p: any) => any) => (b: (p: any) => any) => (p: any) => a(p) !== b(p),
  ">": (a: (p: any) => any) => (b: (p: any) => any) => (p: any) => a(p) > b(p),
  "<": (a: (p: any) => any) => (b: (p: any) => any) => (p: any) => a(p) < b(p),
  ">=": (a: (p: any) => any) => (b: (p: any) => any) => (p: any) => a(p) >= b(p),
  "<=": (a: (p: any) => any) => (b: (p: any) => any) => (p: any) => a(p) <= b(p),

  // Logical. `and`/`or` short-circuit — the second arg only runs when needed.
  and: (a: (p: any) => any) => (b: (p: any) => any) => (p: any) => a(p) && b(p),
  or: (a: (p: any) => any) => (b: (p: any) => any) => (p: any) => a(p) || b(p),
  not: (a: (p: any) => any) => (p: any) => !a(p),

  // Control (ternary). Only the taken branch is evaluated.
  if:
    (c: (p: any) => any) => (t: (p: any) => any) => (e: (p: any) => any) => (p: any) =>
      c(p) ? t(p) : e(p),

  // Read `key` off the object produced by `obj`.
  pick: (obj: (p: any) => Record<string, any>) => (key: (p: any) => string) => (p: any) =>
    obj(p)[key(p)],

  // Sink: defers its argument behind an extra `() =>` layer, which parse's
  // evaluate-step peels — so what survives is the handler `(p) => a(p)`.
  _: (a: (p: any) => any) => () => (p: any) => a(p),
};

export function isOperant(token: any): token is Operant {
  return typeof token === "string" && token in operants;
}

export function isArgPlaceholder(token: any): token is ArgPlaceholder {
  return typeof token === "string" && token.startsWith("@");
}

export type Operant = keyof typeof operants;
