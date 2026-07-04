import type { Operant } from "./operants";

export type ArgPlaceholder = "@";

export type Expr = Array<ArgPlaceholder | Operant | number | string | boolean | Expr>;
