import type { ComponentType } from "react";

// A serializable description of a single prop, surfaced to the LLM so it knows
// how to use a catalog component.
export type PropSchema = {
  type: "string" | "number" | "boolean" | "enum" | "node";
  options?: readonly string[];
  description?: string;
};

// A host-provided component the runtime can render by name (e.g. a shadcn/ui
// component). `component` is the real React component; `props`/`children` are
// metadata describing how it may be used.
export type CatalogEntry = {
  component: ComponentType<any>;
  props?: Record<string, PropSchema>;
  children?: boolean;
  description?: string;
};

export type Catalog = Record<string, CatalogEntry>;
