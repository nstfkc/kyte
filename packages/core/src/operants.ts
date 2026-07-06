import type { ArgPlaceholder } from "./types";

type Fn<T> = (p: any) => T;

// Each operant is curried: it consumes exactly as many following tokens as its
// arity (each already compiled to `(p) => value`), then returns `(p) => result`.
export const operants = {
  // Arithmetic (binary). `+` also concatenates strings, matching JS `+`.
  "+": (a: Fn<any>) => (b: Fn<any>) => (p: any) => a(p) + b(p),
  "-": (a: Fn<number>) => (b: Fn<number>) => (p: any) => a(p) - b(p),
  "*": (a: Fn<number>) => (b: Fn<number>) => (p: any) => a(p) * b(p),
  "/": (a: Fn<number>) => (b: Fn<number>) => (p: any) => a(p) / b(p),
  "%": (a: Fn<number>) => (b: Fn<number>) => (p: any) => a(p) % b(p),

  // Comparison (binary). Equality is strict (=== / !==).
  "==": (a: Fn<any>) => (b: Fn<any>) => (p: any) => a(p) === b(p),
  "!=": (a: Fn<any>) => (b: Fn<any>) => (p: any) => a(p) !== b(p),
  ">": (a: Fn<any>) => (b: Fn<any>) => (p: any) => a(p) > b(p),
  "<": (a: Fn<any>) => (b: Fn<any>) => (p: any) => a(p) < b(p),
  ">=": (a: Fn<any>) => (b: Fn<any>) => (p: any) => a(p) >= b(p),
  "<=": (a: Fn<any>) => (b: Fn<any>) => (p: any) => a(p) <= b(p),

  // Logical. `&&`/`||` short-circuit — the second arg only runs when needed.
  "&&": (a: Fn<any>) => (b: Fn<any>) => (p: any) => a(p) && b(p),
  "||": (a: Fn<any>) => (b: Fn<any>) => (p: any) => a(p) || b(p),
  "!": (a: Fn<any>) => (p: any) => !a(p),

  // Control (ternary). Only the taken branch is evaluated.
  "?": (c: Fn<any>) => (t: Fn<any>) => (e: Fn<any>) => (p: any) => (c(p) ? t(p) : e(p)),

  // Read `key` off the object produced by `obj` (`.` = member access).
  ".": (obj: Fn<Record<string, any>>) => (key: Fn<string>) => (p: any) => obj(p)[key(p)],

  // Sink: defers its argument behind an extra `() =>` layer, which parse's
  // evaluate-step peels — so what survives is the handler `(p) => a(p)`.
  _: (a: Fn<any>) => () => (p: any) => a(p),
};

export function isOperant(token: any): token is Operant {
  return typeof token === "string" && token in operants;
}

export function isArgPlaceholder(token: any): token is ArgPlaceholder {
  return typeof token === "string" && token.startsWith("@");
}

export type Operant = keyof typeof operants;
