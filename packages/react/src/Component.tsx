import { createCompiler, type Compiler } from "@kyte/core";
import type { ApplicationDefinition, ComponentDef, Element, StateExpr } from "./schema";
import type { Catalog } from "./catalog";
import {
  createContext,
  createElement,
  useContext,
  useMemo,
  useSyncExternalStore,
  type ComponentType,
} from "react";
import { useRuntime } from "./Runtime";
import { Store } from "./Store";

interface WrapperContextValue {
  compiler: Compiler;
  store: Store<any>;
  components: Record<string, ComponentDef>;
  catalog: Catalog;
}

const WrapperContext = createContext({} as WrapperContextValue);

// The current item inside a `$each`, exposed to expressions as the `@` placeholder.
const ItemContext = createContext<unknown>(undefined);

// The props of the current component instance, exposed via the `#:name` token.
const PropsContext = createContext<Record<string, any> | undefined>(undefined);

// A parser bound to the live store state, the current `$each` item (`@`), and
// the current component instance props (`#:name`). Subscribing here re-renders
// the node when state changes. Item and props are bound by closure so they
// survive into deferred event handlers.
function useParser(): (expr: any) => any {
  const { compiler, store } = useContext(WrapperContext);
  const item = useContext(ItemContext);
  const props = useContext(PropsContext);
  const state = useSyncExternalStore(store.subscribe, store.getState, store.getState);
  return compiler(state, item, props);
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

// Evaluate a value: an expression, or an object of expressions (e.g. `style`, or
// a component's props).
function parseValue(value: any, parser: (expr: any) => any) {
  if (Array.isArray(value)) return parser(value);
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, parser(v)]));
  }
  return value;
}

// Like parseValue, but coerces a `style` that resolves to a CSS string into an
// object so React doesn't reject it.
function parseAttribute(key: string, value: any, parser: (expr: any) => any) {
  const resolved = parseValue(value, parser);
  return key === "style" && typeof resolved === "string" ? cssStringToStyle(resolved) : resolved;
}

// A tag starting with an uppercase letter is a component reference (a placeholder
// for a component defined in `components`). Lowercase tags are HTML elements.
function isComponentTag(tag: string) {
  return /^[A-Z]/.test(tag);
}

// Dispatch an element by tag. Uppercase tags are component references, resolved
// in priority order: a host catalog component (a real React component, e.g.
// shadcn/ui), then a component defined in the definition, then nothing (a
// placeholder not yet streamed in). Lowercase tags are HTML elements.
function Node(props: { tag: string; nested: Element[] } & Record<string, any>) {
  const { tag, nested, ...rest } = props;
  const { components, catalog } = useContext(WrapperContext);
  if (isComponentTag(tag)) {
    const entry = catalog[tag];
    if (entry) return <ElementNode type={entry.component} nested={nested} {...rest} />;
    const component = components[tag];
    if (component) return <ComponentInstance component={component} propExprs={rest} />;
    return null;
  }
  return <ElementNode type={tag} nested={nested} {...rest} />;
}

// Render a concrete element type (an HTML tag string or a catalog React
// component) with parsed props and resolved children.
const ElementNode = (
  props: { type: string | ComponentType<any>; nested: Element[] } & Record<string, any>,
) => {
  const { type, nested, children, ...attrs } = props;
  const parser = useParser();

  const parsedProps = Object.fromEntries(
    Object.entries(attrs).map(([key, value]) => [key, parseAttribute(key, value, parser)]),
  );
  // Nested elements (the third slot) render as child components; otherwise a
  // `children` attribute expression, when present, is parsed into content.
  const resolvedChildren =
    nested.length > 0
      ? renderElements(nested)
      : children !== undefined
        ? parser(children)
        : undefined;
  return createElement(type as any, parsedProps, resolvedChildren);
};

// Instantiate a component: evaluate the passed prop expressions in the caller's
// scope, then render the component body with those props in scope (as `#:name`).
// The caller's list item is not visible inside — components receive data via props.
function ComponentInstance(props: { component: ComponentDef; propExprs: Record<string, any> }) {
  const parser = useParser();
  const instanceProps = Object.fromEntries(
    Object.entries(props.propExprs).map(([key, value]) => [key, parseValue(value, parser)]),
  );
  return (
    <PropsContext.Provider value={instanceProps}>
      <ItemContext.Provider value={undefined}>
        {renderElements(props.component.render)}
      </ItemContext.Provider>
    </PropsContext.Provider>
  );
}

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
  const { render, state, components } = props.definition;
  const { runtimeContext, catalog } = useRuntime();

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
    <WrapperContext.Provider
      value={{ compiler, store, components: components ?? {}, catalog: catalog ?? {} }}
    >
      {renderElements(render)}
    </WrapperContext.Provider>
  );
};

function renderElements(elements: Element[]) {
  return (
    <>
      {elements.map(([tag, props, children], index) => {
        // Runtime directives use a `$` prefix; everything else is dispatched by
        // Node (component instance vs. HTML element).
        if (tag === "$each") {
          return <EachNode key={index} data={props.data} template={children} />;
        }
        return <Node key={index} tag={tag} {...props} nested={children} />;
      })}
    </>
  );
}
