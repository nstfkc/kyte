import * as z from "zod";
import { Expr } from "./types";

export const exprSchema: z.ZodType<Expr> = z.lazy(() =>
  z.array(z.union([z.string(), z.number(), z.boolean(), exprSchema])),
);
