import { type Runtime as RuntimeType, createRuntimeContext, type Compiler } from "@kyte/core";
import { createContext, ReactNode, useContext } from "react";

interface RuntimeContextValue {
  runtimeContext: (fn: (r: RuntimeType) => Compiler) => Compiler;
}
const RuntimeContext = createContext({} as RuntimeContextValue);

export const Runtime = (props: { children: ReactNode }) => {
  const runtimeContext = createRuntimeContext({
    referenceResolver: () => "",
    componentCatalog: {},
    globalFns: {},
  });
  return (
    <RuntimeContext.Provider value={{ runtimeContext }}>{props.children}</RuntimeContext.Provider>
  );
};

export function useRuntime() {
  return useContext(RuntimeContext);
}
