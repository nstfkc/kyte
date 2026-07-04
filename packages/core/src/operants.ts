import type { ArgPlaceholder } from "./types";

export const operants = {
  "+": (a: (p: any) => number) => (b: (p: any) => number) => (p: any) => a(p) + b(p),
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
