import { createParser } from "@kyte/core";
import type { ComponentDefinition, Element } from "./schema";
import { createContext, createElement, useContext } from "react";

interface WrapperContextValue {
  parser: ReturnType<typeof createParser>;
}

const WrapperContext = createContext({} as WrapperContextValue);

function useResolveComponentTag(tag: string) {
  return (props: any) => createElement(tag, props);
}

const Component = (props: { tag: string } & Record<string, any>) => {
  const { tag, ...rest } = props;
  const C = useResolveComponentTag(tag);
  const { parser } = useContext(WrapperContext);
  return (
    <C {...Object.fromEntries(Object.entries(rest).map(([key, value]) => [key, parser(value)]))} />
  );
};

export const Wrapper = (props: { definition: ComponentDefinition }) => {
  const { props: _props, render, state } = props.definition;
  const parser = createParser({ props: _props, state });
  return (
    <WrapperContext.Provider value={{ parser }}>{renderElements(render)}</WrapperContext.Provider>
  );
};

function renderElements(elements: Element[]) {
  return (
    <>
      {elements.map(([tag, props, children], index) => {
        return (
          <Component key={index} tag={tag} {...props}>
            {renderElements(children)}
          </Component>
        );
      })}
    </>
  );
}
