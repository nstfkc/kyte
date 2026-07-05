import { createCompiler, type Compiler } from "@kyte/core";
import type { ApplicationDefinition, Element, StateExpr } from "./schema";
import { createContext, createElement, useContext, useMemo, useSyncExternalStore } from "react";
import { useRuntime } from "./Runtime";
import { Store } from "./Store";

interface WrapperContextValue {
  compiler: Compiler;
  store: Store<any>;
}

const WrapperContext = createContext({} as WrapperContextValue);

// The current item inside a `$each`, exposed to expressions as the `@` placeholder.
const ItemContext = createContext<unknown>(undefined);

// A parser bound to the live store state and the current `$each` item (which
// feeds `@`). Subscribing here re-renders the node when state changes. The item
// is bound by closure so `@` survives into deferred event handlers.
function useParser(): (expr: any) => any {
  const { compiler, store } = useContext(WrapperContext);
  const item = useContext(ItemContext);
  const state = useSyncExternalStore(store.subscribe, store.getState, store.getState);
  return compiler(state, item);
}

function resolveComponentTag(tag: string) {
  // TODO: named components (from the runtime's componentCatalog) resolve here.
  return (props: any) => createElement(tag, props);
}

// A CSS string ("color: red; margin-top: 4px") -> a React style object, with
// property names camelCased (custom `--props` kept as-is).
function cssStringToStyle(css: string): Record<string, string> {
  const style: Record<string, string> = {};
  for (const declaration of css.split(";")) {
    const sep = declaration.indexOf(":");
    if (sep === -1) continue;
    const prop = declaration.slice(0, sep).trim();
    const value = declaration.slice(sep + 1).trim();
    if (!prop) continue;
    const key = prop.startsWith("--")
      ? prop
      : prop.replace(/-([a-z])/g, (_, c: string) => c.toUpperCase());
    style[key] = value;
  }
  return style;
}

// Resolve an attribute value: an expression, or an object of expressions (e.g.
// `style`). A `style` that resolves to a CSS string is coerced to an object so
// React doesn't reject it.
function parseAttribute(key: string, value: any, parser: (expr: any) => any) {
  if (Array.isArray(value)) {
    const resolved = parser(value);
    return key === "style" && typeof resolved === "string" ? cssStringToStyle(resolved) : resolved;
  }
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, parser(v)]));
  }
  return value;
}

const Component = (props: { tag: string; nested: Element[] } & Record<string, any>) => {
  const { tag, nested, children, ...rest } = props;
  const C = resolveComponentTag(tag);
  const parser = useParser();

  const parsedProps = Object.fromEntries(
    Object.entries(rest).map(([key, value]) => [key, parseAttribute(key, value, parser)]),
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

// `$each` renders its template children once per item in the `data` array,
// binding each item to the `@` placeholder for that subtree.
function EachNode(props: { data: unknown; template: Element[] }) {
  // `useParser` is bound to the parent item, so `data` can reference `@` (e.g.
  // a nested `$each` over a field of the outer item).
  const parser = useParser();
  const items = parser(props.data);
  const list = Array.isArray(items) ? items : [];
  return (
    <>
      {list.map((item, index) => (
        <ItemContext.Provider key={index} value={item}>
          {renderElements(props.template)}
        </ItemContext.Provider>
      ))}
    </>
  );
}

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

  // Create the store (and the compiler bound to it) once per definition so
  // state survives re-renders instead of resetting on every render.
  const { store, compiler } = useMemo(() => {
    const store = new Store(parseState(state));
    const compiler = runtimeContext(store)(createCompiler());
    return { store, compiler };
  }, [props.definition, runtimeContext]);

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
        // Runtime directives use a `$` prefix. (Future component placeholders,
        // resolved from the runtime's componentCatalog, dispatch here too.)
        if (tag === "$each") {
          return <EachNode key={index} data={props.data} template={children} />;
        }
        return <Component key={index} tag={tag} {...props} nested={children} />;
      })}
    </>
  );
}
