import { type Runtime as RuntimeType, createRuntimeContext, type Compiler } from "@kyte/core";
import { createContext, ReactNode, useContext } from "react";
import { Store } from "./Store";
import type { Catalog } from "./catalog";

interface RuntimeContextValue {
  runtimeContext: (store: Store<any>) => (fn: (r: RuntimeType) => Compiler) => Compiler;
  // Host-provided components the runtime can render by name (e.g. shadcn/ui).
  catalog: Catalog;
}

const RuntimeContext = createContext({} as RuntimeContextValue);

export const Runtime = (props: { children: ReactNode; catalog?: Catalog }) => {
  const runtimeContext = (store: Store<any>) =>
    createRuntimeContext({
      // TODO: reference resolution / global fns are stubs.
      referenceResolver: () => "",
      componentCatalog: {},
      globalFns: {},
      stateSetter: (key: string) => (value: any) =>
        store.next({ ...store.getState(), [key]: value }),
    });

  return (
    <RuntimeContext.Provider value={{ runtimeContext, catalog: props.catalog ?? {} }}>
      {props.children}
    </RuntimeContext.Provider>
  );
};

export function useRuntime() {
  return useContext(RuntimeContext);
}
