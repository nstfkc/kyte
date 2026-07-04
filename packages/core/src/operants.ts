import type { ArgPlaceholder } from "./types";

export const operants = {
  "+": (a: (p: any) => number) => (b: (p: any) => number) => (p: any) => a(p) + b(p),
  pick: (obj: (p: any) => Record<string, any>) => (key: (p: any) => string) => (p: any) =>
    obj(p)[key(p)],
  // Sink: a prefix operant. The extra `() =>` layer is peeled by parse's
  // evaluate-step, so what survives is the handler `(p) => a(p)` — a function
  // that passes the arg through, instead of a collapsed value.
  _: (a: (p: any) => any) => () => (p: any) => a(p),
};

export function isOperant(token: any): token is Operant {
  return typeof token === "string" && token in operants;
}

export function isArgPlaceholder(token: any): token is ArgPlaceholder {
  return typeof token === "string" && token.startsWith("@");
}

export function isReference(token: any): token is string {
  if (typeof token !== "string") return false;
  const [prefix] = token.split(":");
  return prefix === "#";
}

export type Operant = keyof typeof operants;
