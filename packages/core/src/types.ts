import type { Operant } from "./operants";

export type ArgPlaceholder = "@";
export type StateGetter = `$:${string}`;
export type StateSetter = `$$:${string}`;
export type GlobalFnRef = `fn:${string}`;

type RuntimeTokens = ArgPlaceholder | Operant | StateGetter | StateSetter | GlobalFnRef;

export type Expr = Array<RuntimeTokens | number | string | boolean | Expr>;
