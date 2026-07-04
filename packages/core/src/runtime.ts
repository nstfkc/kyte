interface CreateRuntimeParams {
  globalFns: Record<string, Function>;
  componentCatalog: Record<string, any>;
  referenceResolver: (ref: string) => any;
  stateSetter: (ref: string) => (value: any) => void;
}

export type Runtime = {
  resolveReference: (ref: string) => any;
  setState: (ref: string) => (value: any) => void;
};

export function createRuntimeContext(params: CreateRuntimeParams) {
  const runtime: Runtime = {
    resolveReference: (ref) => params.referenceResolver(ref),
    setState: (ref) => (value) => params.stateSetter(ref)(value),
  };

  return <T,>(fn: (runtime: Runtime) => T): T => fn(runtime);
}
