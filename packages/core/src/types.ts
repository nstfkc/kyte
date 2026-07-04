import type { Operant } from "./operants";

export type ArgPlaceholder = "@";
export type StateGetter = `$:{string}`;
export type StateSetter = `$$:{string}`;

type RuntimeTokens = ArgPlaceholder | Operant | StateGetter | StateSetter;

export type Expr = Array<RuntimeTokens | number | string | boolean | Expr>;
