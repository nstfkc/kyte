import type { ArgPlaceholder } from "./types";

type Fn<T> = (p: any) => T;

// Return a copy of `obj` with the dot-path `path` set to `value`, cloning only
// along the path (structural sharing elsewhere). Immutable on purpose — the
// Store compares by reference, so a real mutation wouldn't trigger a re-render.
function setIn(obj: any, path: string, value: any): any {
  const [head, ...rest] = path.split(".");
  const base = Array.isArray(obj) ? [...obj] : { ...(obj ?? {}) };
  base[head as string] = rest.length ? setIn(obj?.[head as string], rest.join("."), value) : value;
  return base;
}

// Each operant is curried: it consumes exactly as many following tokens as its
// arity (each already compiled to `(p) => value`), then returns `(p) => result`.
export const operants = {
  // Arithmetic (binary). `+` also concatenates strings, matching JS `+`, and is
  // variadic: the compiler folds ["+", a, b, c] into ["+", ["+", a, b], c], and
  // ["+", x] is just x.
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

  // Immutable member-assign (the write counterpart of `.`): return a copy of
  // `obj` with the dot-path `path` set to `value`. `path` is a plain dot-joined
  // string literal; `value` is any expression (often the `@@` event arg). Pairs
  // with a `$$:` setter to update state, e.g.
  // ["_", [[".=", "$:state", ["foo.bar"], "@@"], "$$:state"]].
  ".=": (obj: Fn<any>) => (path: Fn<string>) => (value: Fn<any>) => (p: any) =>
    setIn(obj(p), path(p), value(p)),

  // Function application: apply the function `fn` produces to `arg`. Global
  // functions are unary by convention (`fn:name` resolves one), so multi-arg
  // calls curry — unfold them with nested `()`, e.g. ["()", ["()", "fn:add",
  // 1], 2]. Applies any function value, not just `fn:` globals — a curried
  // partial or a function held in state/props works the same way.
  "()": (fn: Fn<any>) => (arg: Fn<any>) => (p: any) => fn(p)(arg(p)),

  // Sink: defers its argument behind an extra `() =>` layer, which parse's
  // evaluate-step peels — so what survives is the handler `(p) => a(p)`.
  _: (a: Fn<any>) => () => (p: any) => a(p),
};

export function isOperant(token: any): token is Operant {
  return typeof token === "string" && token in operants;
}

export function isArgPlaceholder(token: any): token is ArgPlaceholder {
  // Exactly "@" — other "@…" strings (e.g. "@handle") are literal text. "@@"
  // (the event arg) is matched by the compiler before this check.
  return token === "@";
}

export type Operant = keyof typeof operants;

// Operants that take their arity *or more* arguments, folded left to right.
export const variadicOperants: ReadonlySet<Operant> = new Set<Operant>(["+"]);

// How many arguments each operant consumes (the minimum, for variadic ones). Typed as `Record<Operant, number>`
// so a new operant must declare its arity (the validator relies on it).
export const operantArity: Record<Operant, number> = {
  "+": 1, // variadic: ["+", x] is x, more args fold left
  "-": 2,
  "*": 2,
  "/": 2,
  "%": 2,
  "==": 2,
  "!=": 2,
  ">": 2,
  "<": 2,
  ">=": 2,
  "<=": 2,
  "&&": 2,
  "||": 2,
  "!": 1,
  "?": 3,
  ".": 2,
  ".=": 3,
  "()": 2,
  _: 1,
};
