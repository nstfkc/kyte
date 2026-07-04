import * as z from "zod";
import { exprSchema } from "@kyte/core";

const state = z.record(z.string(), z.object({ type: z.string(), value: z.any() }));

export type Element = [string, Record<string, z.infer<typeof exprSchema>>, Element[]];

const element: z.ZodType<Element> = z.lazy(() =>
  z.tuple([z.string(), z.record(z.string(), exprSchema), z.array(element)]),
);
const render = z.array(element);

export type StateExpr = z.Infer<typeof state>;
export type RenderExpr = z.Infer<typeof render>;

export type ApplicationDefinition = {
  state: StateExpr;
  render: RenderExpr;
};
