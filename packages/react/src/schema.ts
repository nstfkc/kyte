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

// A reusable component: a props schema (what it accepts) plus a render tree that
// reads those props via the `#:propName` token.
const component = z.object({
  props: z.record(z.string(), z.object({ type: z.string() })),
  render,
});

export const applicationDefinition = z.object({
  state,
  render,
  // Named, reusable components — kept last so they can be defined after the
  // render tree that references them. A render element whose tag matches a name
  // here instantiates that component, passing the element's props as its props.
  components: z.record(z.string(), component).optional(),
});

export type StateExpr = z.infer<typeof state>;
export type RenderExpr = z.infer<typeof render>;
export type ComponentDef = z.infer<typeof component>;

export type ApplicationDefinition = z.infer<typeof applicationDefinition>;
