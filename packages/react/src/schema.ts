import * as z from "zod";
import { exprSchema } from "@kyte/core";

const state = z.record(z.string(), z.object({ type: z.string(), value: z.any() }));

// An attribute value is an expression, or an object of expressions — the latter
// for object-valued props like `style` ({ marginRight: ["+", "$:spacing", "em"] }).
const attributeValue = z.union([exprSchema, z.record(z.string(), exprSchema)]);

type Expr = z.infer<typeof exprSchema>;
type AttributeValue = Expr | Record<string, Expr>;

export type Element = [string, Record<string, AttributeValue>, Element[]];

const element: z.ZodType<Element> = z.lazy(() =>
  z.tuple([z.string(), z.record(z.string(), attributeValue), z.array(element)]),
);
const render = z.array(element);

export const applicationDefinition = z.object({ state, render });

export type StateExpr = z.infer<typeof state>;
export type RenderExpr = z.infer<typeof render>;

export type ApplicationDefinition = z.infer<typeof applicationDefinition>;
