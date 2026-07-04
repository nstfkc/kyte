import { type Runtime as RuntimeType, createRuntimeContext, type Compiler } from "@kyte/core";
import { createContext, ReactNode, useContext } from "react";
import { Store } from "./Store";

interface RuntimeContextValue {
  runtimeContext: (store: Store<any>) => (fn: (r: RuntimeType) => Compiler) => Compiler;
}

const RuntimeContext = createContext({} as RuntimeContextValue);

export const Runtime = (props: { children: ReactNode }) => {
  const runtimeContext = (store: Store<any>) =>
    createRuntimeContext({
      // TODO: reference resolution / component catalog / global fns are stubs.
      referenceResolver: () => "",
      componentCatalog: {},
      globalFns: {},
      stateSetter: (key: string) => (value: any) =>
        store.next({ ...store.getState(), [key]: value }),
    });

  return (
    <RuntimeContext.Provider value={{ runtimeContext }}>{props.children}</RuntimeContext.Provider>
  );
};

export function useRuntime() {
  return useContext(RuntimeContext);
}
