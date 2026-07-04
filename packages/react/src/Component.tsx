import { createCompiler, type Compiler } from "@kyte/core";
import type { ComponentDefinition, Element } from "./schema";
import { createContext, createElement, useContext } from "react";
import { useRuntime } from "./Runtime";

interface WrapperContextValue {
  compiler: Compiler;
}

const WrapperContext = createContext({} as WrapperContextValue);

function useResolveComponentTag(tag: string) {
  return (props: any) => createElement(tag, props);
}

const Component = (props: { tag: string; nested: Element[] } & Record<string, any>) => {
  const { tag, nested, children, ...rest } = props;
  const C = useResolveComponentTag(tag);
  const { compiler } = useContext(WrapperContext);
  const parsedProps = Object.fromEntries(
    Object.entries(rest).map(([key, value]) => [key, compiler(value)]),
  );
  // Nested elements (the third slot) render as child components; otherwise a
  // `children` attribute expression, when present, is parsed into content.
  const resolvedChildren =
    nested.length > 0
      ? renderElements(nested)
      : children !== undefined
        ? compiler(children)
        : undefined;
  return <C {...parsedProps}>{resolvedChildren}</C>;
};

export const Wrapper = (props: { definition: ComponentDefinition }) => {
  const { props: _props, render, state } = props.definition;
  const { runtimeContext } = useRuntime();
  if (!runtimeContext) {
    throw new Error("Component tree must be wrapped with Runtime");
  }
  const compiler = runtimeContext(createCompiler({ props: _props, state }));
  return (
    <WrapperContext.Provider value={{ compiler }}>{renderElements(render)}</WrapperContext.Provider>
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
