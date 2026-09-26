import { createCompiler, type Compiler } from "@kyte/core";
import type { ApplicationDefinition, ComponentDef, Element, StateExpr } from "./schema";
import type { Catalog } from "./catalog";
import {
  Component as ReactComponent,
  createContext,
  createElement,
  useContext,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
  type ComponentType,
  type ReactNode,
} from "react";
import { parsePartialDefinition } from "./partial";
import { upgradeDefinition } from "./version";
import { useRuntime } from "./Runtime";
import { Store } from "./Store";

interface WrapperContextValue {
  compiler: Compiler;
  store: Store<any>;
  components: Record<string, ComponentDef>;
  catalog: Catalog;
  // Rendering a still-streaming definition: evaluation errors and cut-off
  // expressions are tolerated instead of surfacing.
  partial: boolean;
  // Stamp component instances' root DOM nodes with `data-kyte-component`.
  annotate: boolean;
  selectedComponent?: string;
  // Reports evaluation/render failures of complete definitions (not mid-stream).
  reportError: (error: unknown, info: ElementErrorInfo) => void;
}

export type ElementErrorInfo = {
  // The failing element's position in the definition, in the same form as
  // schema issue paths: "render.0.2.1" or "components.Footer.render.0".
  path: string;
  // The innermost definition component whose render contains the element.
  component?: string;
};

const WrapperContext = createContext({} as WrapperContextValue);

// The path of the element being rendered (see ElementErrorInfo.path).
const PathContext = createContext("render");

// The innermost definition component instance being rendered, if any.
const ComponentNameContext = createContext<string | undefined>(undefined);

// The names of the component instances whose render roots are being rendered,
// innermost first (several when a component's root is another component). Set
// by ComponentInstance, cleared below the first DOM element. Only used when
// annotating.
const RootsContext = createContext<string[] | null>(null);

// The current item inside a `$each`, exposed to expressions as the `@` placeholder.
const ItemContext = createContext<unknown>(undefined);

// The props of the current component instance, exposed via the `#:name` token.
const PropsContext = createContext<Record<string, any> | undefined>(undefined);

// A parser bound to the live store state, the current `$each` item (`@`), and
// the current component instance props (`#:name`). Subscribing here re-renders
// the node when state changes. Item and props are bound by closure so they
// survive into deferred event handlers.
// A failing expression evaluates to undefined (renders as empty) instead of
// taking the page down; outside partial mode it is reported via `onError`.
// (Mid-stream, reads of state or props that haven't arrived yet are expected.)
function useParser(): (expr: any) => any {
  const { compiler, store, partial, reportError } = useContext(WrapperContext);
  const item = useContext(ItemContext);
  const props = useContext(PropsContext);
  const path = useContext(PathContext);
  const component = useContext(ComponentNameContext);
  const state = useSyncExternalStore(store.subscribe, store.getState, store.getState);
  const parse = compiler(state, item, props);
  return (expr) => {
    try {
      return parse(expr);
    } catch (error) {
      if (!partial) reportError(error, { path, component });
      return undefined;
    }
  };
}

// A cut-off expression (e.g. `["+", "a"`) evaluates to a curried function. Mid-
// stream, drop such values except in event handlers, where functions belong.
function isStreamingArtifact(key: string, value: unknown) {
  return typeof value === "function" && !/^on[A-Z]/.test(key);
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
// Arrays are expressions; bare scalars are literal values, never tokens.
function parseValue(value: any, parser: (expr: any) => any) {
  if (Array.isArray(value)) return parser(value);
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value).map(([k, v]) => [k, Array.isArray(v) ? parser(v) : v]),
    );
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
    if (component) return <ComponentInstance name={tag} component={component} propExprs={rest} />;
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
  const { partial, selectedComponent } = useContext(WrapperContext);
  const roots = useContext(RootsContext);

  const parsedProps = Object.fromEntries(
    Object.entries(attrs)
      .map(([key, value]) => [key, parseAttribute(key, value, parser)])
      .filter(([key, value]) => !(partial && isStreamingArtifact(key, value))),
  );
  // Nested elements (the third slot) render as child components; otherwise a
  // `children` attribute expression, when present, is parsed into content.
  const path = useContext(PathContext);
  let resolvedChildren =
    nested.length > 0
      ? renderElements(nested, `${path}.2`)
      : children !== undefined
        ? Array.isArray(children)
          ? parser(children)
          : children
        : undefined;
  if (partial && isStreamingArtifact("children", resolvedChildren)) resolvedChildren = undefined;
  if (roots) {
    // A root DOM node of one or more component instances (catalog components
    // receive these as props and must forward them to their DOM, as shadcn does).
    parsedProps["data-kyte-component"] = roots.join(" ");
    if (selectedComponent && roots.includes(selectedComponent)) {
      parsedProps["data-kyte-selected"] = "";
    }
    resolvedChildren = <RootsContext.Provider value={null}>{resolvedChildren}</RootsContext.Provider>;
  }
  return createElement(type as any, parsedProps, resolvedChildren);
};

// Instantiate a component: evaluate the passed prop expressions in the caller's
// scope, then render the component body with those props in scope (as `#:name`).
// The caller's list item is not visible inside — components receive data via props.
function ComponentInstance(props: {
  name: string;
  component: ComponentDef;
  propExprs: Record<string, any>;
}) {
  const parser = useParser();
  const { annotate } = useContext(WrapperContext);
  // Non-null only when this instance is itself a render root of an outer one.
  const outer = useContext(RootsContext);
  const instanceProps = Object.fromEntries(
    Object.entries(props.propExprs).map(([key, value]) => [key, parseValue(value, parser)]),
  );
  const body = (
    <ComponentNameContext.Provider value={props.name}>
      <PropsContext.Provider value={instanceProps}>
        <ItemContext.Provider value={undefined}>
          {renderElements(props.component.render, `components.${props.name}.render`)}
        </ItemContext.Provider>
      </PropsContext.Provider>
    </ComponentNameContext.Provider>
  );
  if (!annotate) return body;
  return (
    <RootsContext.Provider value={[props.name, ...(outer ?? [])]}>{body}</RootsContext.Provider>
  );
}

// `$if` renders its children only while `condition` is truthy.
function IfNode(props: { condition: unknown; branch: Element[] }) {
  const parser = useParser();
  const path = useContext(PathContext);
  const condition = Array.isArray(props.condition) ? parser(props.condition) : props.condition;
  // A function is a cut-off expression mid-stream (`["==", "$:plan"`), not a
  // meaningful condition — don't flash the branch.
  const shown = typeof condition === "function" ? false : Boolean(condition);
  return shown ? renderElements(props.branch, `${path}.2`) : null;
}

// `$each` renders its template children once per item in the `data` array,
// binding each item to the `@` placeholder for that subtree.
function EachNode(props: { data: unknown; template: Element[] }) {
  // `useParser` is bound to the parent item, so `data` can reference `@` (e.g.
  // a nested `$each` over a field of the outer item).
  const parser = useParser();
  const path = useContext(PathContext);
  const items = parser(props.data);
  const list = Array.isArray(items) ? items : [];
  return (
    <>
      {list.map((item, index) => (
        <ItemContext.Provider key={index} value={item}>
          {renderElements(props.template, `${path}.2`)}
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

// Bring the store in line with a new definition's initial state without
// clobbering interaction: a key is (re)initialized when it's new, or when its
// store value is still the untouched initial value from the previous definition
// (so a streaming array/object keeps growing until the user changes it). Keys
// that disappear are kept. Writes silently — the caller is mid-render and every
// node re-renders with it, reading the updated state.
function reconcileState(store: Store<any>, seen: Record<string, any>, initial: Record<string, any>) {
  let next = store.getState();
  for (const [key, value] of Object.entries(initial)) {
    const untouched = key in seen ? next[key] === seen[key] : !(key in next);
    if (untouched && next[key] !== value) next = { ...next, [key]: value };
    seen[key] = value;
  }
  if (next !== store.getState()) store.replace(next);
}

type AnnotationProps = {
  // Mark each component instance's DOM for inspection (e.g. an editor preview):
  // every root DOM node of an instance gets `data-kyte-component="<Name>"`. When
  // a component's root is another component, the node lists both, innermost
  // first ("Inner Outer"), so `[data-kyte-component~="Outer"]` matches it too.
  // Resolve a click with `getComponentAt(event.target)`.
  annotate?: boolean;
  // With `annotate`: every instance of this component also gets
  // `data-kyte-selected` on its root nodes, for the host to style.
  selectedComponent?: string;
};

type ErrorProps = {
  // Called when an element of a complete (non-partial) definition fails to
  // evaluate or render. The failing element renders as empty either way — one
  // bad expression never blanks the page. Called during render: log, or defer
  // any state update. Mid-stream (`partial`) failures are expected and silent.
  onError?: (error: unknown, info: ElementErrorInfo) => void;
};

export type WrapperProps = AnnotationProps &
  ErrorProps &
  (
    | { definition: ApplicationDefinition; partial?: false }
    // A still-streaming definition: raw JSON text, or a best-effort parse of it.
    // Incomplete elements are skipped, missing components render nothing, and
    // evaluation errors render as empty instead of throwing.
    | { definition: unknown; partial: true }
  );

// Renders an ApplicationDefinition. The store lives as long as the Wrapper, so
// state survives new definition snapshots (streaming, or a revised definition);
// give the Wrapper a new `key` to start from fresh state.
export const Wrapper = (props: WrapperProps) => {
  const partial = props.partial === true;
  const definition = useMemo(
    () =>
      partial
        ? parsePartialDefinition(props.definition)
        : (upgradeDefinition(props.definition) as ApplicationDefinition),
    [partial, props.definition],
  );
  const { render, state, components } = definition;
  const { runtimeContext, catalog } = useRuntime();

  if (!runtimeContext) {
    throw new Error("Component tree must be wrapped with Runtime");
  }

  const seen = useRef<Record<string, any>>({});
  const [store] = useState(() => {
    const initial = parseState(state);
    seen.current = { ...initial };
    return new Store(initial);
  });
  reconcileState(store, seen.current, parseState(state));

  const compiler = useMemo(() => runtimeContext(store)(createCompiler()), [store, runtimeContext]);
  const onError = useRef(props.onError);
  onError.current = props.onError;
  const reportError = useMemo(
    () => (error: unknown, info: ElementErrorInfo) => onError.current?.(error, info),
    [],
  );

  return (
    <WrapperContext.Provider
      value={{
        compiler,
        store,
        components: components ?? {},
        catalog: catalog ?? {},
        partial,
        annotate: props.annotate === true,
        selectedComponent: props.selectedComponent,
        reportError,
      }}
    >
      {renderElements(render, "render")}
    </WrapperContext.Provider>
  );
};

// Isolates a render error to one element: it renders as empty instead of
// taking the page down. Mid-stream (e.g. a catalog component choking on half-
// arrived props) it retries on the next snapshot, when `element` is a new
// tuple; for a complete definition the error is reported via `onError`.
// (Error boundaries don't run during SSR; evaluation errors are caught in
// useParser, which covers SSR too.)
class ElementBoundary extends ReactComponent<
  { element: Element; onError: (error: unknown) => void; children: ReactNode },
  { element: Element; error?: unknown }
> {
  constructor(props: ElementBoundary["props"]) {
    super(props);
    this.state = { element: props.element };
  }

  static getDerivedStateFromError(error: unknown) {
    return { error };
  }

  static getDerivedStateFromProps(
    props: { element: Element },
    state: { element: Element; error?: unknown },
  ) {
    return props.element === state.element ? null : { element: props.element, error: undefined };
  }

  componentDidCatch(error: unknown) {
    this.props.onError(error);
  }

  render() {
    return this.state.error === undefined ? this.props.children : null;
  }
}

function ElementSlot(props: { element: Element; path: string; children: ReactNode }) {
  const { partial, reportError } = useContext(WrapperContext);
  const component = useContext(ComponentNameContext);
  const onError = (error: unknown) => {
    if (!partial) reportError(error, { path: props.path, component });
  };
  return (
    <PathContext.Provider value={props.path}>
      <ElementBoundary element={props.element} onError={onError}>
        {props.children}
      </ElementBoundary>
    </PathContext.Provider>
  );
}

// `base` is the path of the `elements` array in the definition.
function renderElements(elements: Element[], base: string) {
  return (
    <>
      {elements.map((element, index) => {
        const [tag, props, children] = element;
        // Runtime directives use a `$` prefix; everything else is dispatched by
        // Node (component instance vs. HTML element).
        const node =
          tag === "$each" ? (
            <EachNode data={props.data} template={children} />
          ) : tag === "$if" ? (
            <IfNode condition={props.condition} branch={children} />
          ) : (
            <Node tag={tag} {...props} nested={children} />
          );
        return (
          <ElementSlot key={index} element={element} path={`${base}.${index}`}>
            {node}
          </ElementSlot>
        );
      })}
    </>
  );
}

export type ComponentHit = {
  // The innermost named component containing the target.
  name: string;
  // Every component whose root is the matched node, innermost first.
  names: string[];
  // The annotated root DOM node of that instance.
  element: HTMLElement;
};

// Resolve a DOM event target inside an annotated Wrapper (`annotate`) to the
// innermost definition component instance containing it, or null if the target
// isn't inside one.
export function getComponentAt(target: EventTarget | null): ComponentHit | null {
  if (!(target instanceof Element)) return null;
  const element = target.closest<HTMLElement>("[data-kyte-component]");
  const names = element?.dataset.kyteComponent?.split(" ").filter(Boolean) ?? [];
  if (!element || !names.length) return null;
  return { name: names[0]!, names, element };
}
