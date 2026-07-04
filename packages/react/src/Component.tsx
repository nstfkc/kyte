import { createCompiler, type Compiler } from "@kyte/core";
import type { ApplicationDefinition, Element, StateExpr } from "./schema";
import { createContext, createElement, useContext, useSyncExternalStore } from "react";
import { useRuntime } from "./Runtime";
import { Store } from "./Store";

interface WrapperContextValue {
  compiler: Compiler;
  store: Store<any>;
}

const WrapperContext = createContext({} as WrapperContextValue);

function useResolveComponentTag(tag: string) {
  return (props: any) => createElement(tag, props);
}

const emptyStore = new Store(null);

const Component = (props: { tag: string; nested: Element[] } & Record<string, any>) => {
  const { tag, nested, children, ...rest } = props;
  const C = useResolveComponentTag(tag);
  const { compiler, store } = useContext(WrapperContext);

  // If component doesn't read value from store, subscribe to empty store
  const _store = JSON.stringify(props).includes("$:") ? store : emptyStore;
  const state = useSyncExternalStore(_store.subscribe, _store.getState, _store.getState);

  const parser = compiler(state);

  const parsedProps = Object.fromEntries(
    Object.entries(rest).map(([key, value]) => [key, parser(value)]),
  );
  // Nested elements (the third slot) render as child components; otherwise a
  // `children` attribute expression, when present, is parsed into content.
  const resolvedChildren =
    nested.length > 0
      ? renderElements(nested)
      : children !== undefined
        ? parser(children)
        : undefined;
  return <C {...parsedProps}>{resolvedChildren}</C>;
};

function parseState(state: StateExpr) {
  const out: Record<string, any> = {};
  for (const [key, value] of Object.entries(state)) {
    out[key] = value.value;
  }
  return out;
}

export const Wrapper = (props: { definition: ApplicationDefinition }) => {
  const { render, state } = props.definition;
  const { runtimeContext } = useRuntime();

  if (!runtimeContext) {
    throw new Error("Component tree must be wrapped with Runtime");
  }

  const store = new Store(parseState(state));
  const runtime = runtimeContext(store);
  const compiler = runtime(createCompiler());

  return (
    <WrapperContext.Provider value={{ compiler, store }}>
      {renderElements(render)}
    </WrapperContext.Provider>
  );
};

function renderElements(elements: Element[]) {
  return (
    <>
      {elements.map(([tag, props, children], index) => {
        return <Component key={index} tag={tag} {...props} nested={children} />;
      })}
    </>
  );
}
