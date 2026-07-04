import type { Expr } from "./types";

interface CreateRuntimeParams {
  globalFns: Record<string, Function>;
  componentCatalog: Record<string, any>;
  referenceResolver: (ref: string) => any;
}

export type Runtime = {
  resolveReference: (ref: string) => any;
};

export function createRuntimeContext(params: CreateRuntimeParams) {
  function resolveReference(p: any) {
    return p;
  }
  const runtime: Runtime = {
    resolveReference,
  };

  return (fn: (runtime: Runtime) => (exp: Expr) => any) => {
    return fn(runtime);
  };
}
