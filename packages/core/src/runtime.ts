import type { Expr } from "./types";

interface CreateRuntimeParams {
  globalFns: Record<string, Function>;
  componentCatalog: Record<string, any>;
  referenceResolver: (ref: string) => any;
  stateSetter: (ref: string, value: any) => void;
}

export type Runtime = {
  resolveReference: (ref: string) => any;
  setState: (ref: string) => (value: any) => void;
};

export function createRuntimeContext(params: CreateRuntimeParams) {
  function resolveReference(p: any) {
    return p;
  }
  const runtime: Runtime = {
    resolveReference,
    setState: (ref: string) => (value: any) => {
      params.stateSetter(ref, value);
    },
  };

  return (fn: (runtime: Runtime) => (exp: Expr) => any) => {
    return fn(runtime);
  };
}
