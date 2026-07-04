import { createParser, Expr } from "@kyte/core";
import type { ComponentDefinition, Element } from "./schema";
import { createElement, Fragment } from "react";

export function createComponent(definition: ComponentDefinition) {
  const { state, props, render } = definition;
  const parse = createParser({ state, props });

  function renderElement(element: Element): any {
    const [tag, attributes = {}, children = []] = element;

    return createElement(
      tag,
      Object.fromEntries(Object.entries(attributes).map(([key, value]) => [key, parse(value)])),
      ...children.map(renderElement),
    );
  }

  return function Component(props: any) {
    const parsedRender = render.map(renderElement);

    return createElement(Fragment, null, ...parsedRender);
  };
}
