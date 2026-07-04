import * as z from "zod";
import { exprSchema } from "@kyte/core";

const state = z.object(z.record(z.string(), z.object({ type: z.string(), initial: exprSchema })));
const props = z.object(z.record(z.string(), z.object({ type: z.string() })));

export type Element = [string, Record<string, z.infer<typeof exprSchema>>, Element[]];

const element: z.ZodType<Element> = z.lazy(() =>
  z.tuple([z.string(), z.record(z.string(), exprSchema), z.array(element)]),
);
const render = z.array(element);

export type ComponentDefinition = {
  state: z.infer<typeof state>;
  props: z.infer<typeof props>;
  render: z.infer<typeof render>;
};
