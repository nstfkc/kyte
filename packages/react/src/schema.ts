import * as z from "zod";
import type { Expr } from "@kyte/core";
import { validateDefinition } from "./validate";

// A bare JSON scalar is that literal value ("40px" ≡ ["40px"]); it is never
// read as a token — `"$:count"` is the text "$:count". Arrays are expressions.
type Value = Expr | string | number | boolean;

// An attribute value is an expression or scalar, or an object of them — the
// latter for object-valued props like `style` ({ marginRight: ["+", "$:spacing", "em"] }).
type AttributeValue = Value | Record<string, Value>;

export type Element = [string, Record<string, AttributeValue>, Element[]];

export type StateExpr = Record<string, { type: string; value: any }>;
export type RenderExpr = Element[];

// A reusable component: a props schema (what it accepts; optional when it takes
// none) plus a render tree that reads those props via the `#:propName` token.
export type ComponentDef = { props?: Record<string, { type: string }>; render: Element[] };

export type ApplicationDefinition = {
  // The format version (see FORMAT_VERSION). Omitted means current — stamp it
  // when storing a definition so it can be upgraded after format changes.
  version?: number;
  state: StateExpr;
  render: RenderExpr;
  // Named, reusable components — kept last so they can be defined after the
  // render tree that references them. A render element whose tag matches a name
  // here instantiates that component, passing the element's props as its props.
  components?: Record<string, ComponentDef>;
};

// Validates structure and expressions (operator arity, token scope, declared
// state) via `validateDefinition`, whose issues name the likely mistake — so a
// model can fix its output from the messages alone.
export const applicationDefinition = z.unknown().superRefine((value, ctx) => {
  for (const issue of validateDefinition(value)) {
    ctx.addIssue({ code: "custom", message: issue.message, path: issue.path, input: value });
  }
}) as unknown as z.ZodType<ApplicationDefinition>;
