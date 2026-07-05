import { expect, test } from "vitest";
import { createCompiler } from "./compiler";
import { createRuntimeContext } from "./runtime";
import type { Expr } from "./types";

// Build a parser bound to `state`, an optional `item` (the `@` placeholder), and
// optional component `props` (`#:name`), with a no-op runtime.
function parserFor(state: Record<string, any> = {}, item?: any, props?: any) {
  const applyRuntime = createRuntimeContext({
    referenceResolver: (ref) => ref,
    componentCatalog: {},
    globalFns: {},
    stateSetter: () => () => {},
  });
  return applyRuntime(createCompiler())(state, item, props);
}

const parse = parserFor();

test("arithmetic", () => {
  expect(parse(["+", 1, 2])).toBe(3);
  expect(parse(["-", 5, 2])).toBe(3);
  expect(parse(["*", 4, 3])).toBe(12);
  expect(parse(["/", 12, 4])).toBe(3);
  expect(parse(["%", 7, 3])).toBe(1);
});

test("+ concatenates strings", () => {
  expect(parse(["+", "a", "b"])).toBe("ab");
});

test("comparison", () => {
  expect(parse(["==", 1, 1])).toBe(true);
  expect(parse(["==", 1, 2])).toBe(false);
  expect(parse(["!=", 1, 2])).toBe(true);
  expect(parse([">", 2, 1])).toBe(true);
  expect(parse(["<", 2, 1])).toBe(false);
  expect(parse([">=", 2, 2])).toBe(true);
  expect(parse(["<=", 1, 2])).toBe(true);
});

test("logical", () => {
  expect(parse(["and", true, false])).toBe(false);
  expect(parse(["and", true, true])).toBe(true);
  expect(parse(["or", false, true])).toBe(true);
  expect(parse(["not", false])).toBe(true);
});

test("if selects only the taken branch", () => {
  expect(parse(["if", ["==", 1, 1], "yes", "no"])).toBe("yes");
  expect(parse(["if", ["==", 1, 2], "yes", "no"])).toBe("no");
});

test("nested composition", () => {
  // (2 + 3) * 4
  expect(parse(["*", ["+", 2, 3], 4])).toBe(20);
});

test("operants read state via getters", () => {
  const p = parserFor({ count: 10 });
  expect(p(["+", "$:count", 5])).toBe(15);
  expect(p(["if", [">", "$:count", 5], "big", "small"])).toBe("big");
});

test("Expr is accepted as input type", () => {
  const expr: Expr = ["+", 1, 2];
  expect(parse(expr)).toBe(3);
});

test("@ resolves to the bound item", () => {
  expect(parserFor({}, 42)(["@"])).toBe(42);
  expect(parserFor({}, { name: "Ada" })(["pick", ["@"], ["name"]])).toBe("Ada");
  expect(parserFor({}, { name: "Ada" })(["+", "Hi ", ["pick", ["@"], ["name"]]])).toBe("Hi Ada");
});

test("#:name resolves to component props", () => {
  expect(parserFor({}, undefined, { title: "Hi" })(["#:title"])).toBe("Hi");
  expect(parserFor({}, undefined, { order: { id: 7 } })(["pick", ["#:order"], ["id"]])).toBe(7);
});

test("@ (item) survives into a deferred handler via the _ sink", () => {
  // The item is closed over, so it is still available when the handler runs —
  // unlike the event arg, which the sink injects at call time.
  const sets: Array<[string, any]> = [];
  const applyRuntime = createRuntimeContext({
    referenceResolver: (ref) => ref,
    componentCatalog: {},
    globalFns: {},
    stateSetter: (ref) => (value) => sets.push([ref, value]),
  });
  const parse = applyRuntime(createCompiler())({}, { id: "row-7" });
  const handler = parse(["_", [["pick", ["@"], ["id"]], "$$:selected"]]);
  handler({ some: "event" }); // fire it
  expect(sets).toEqual([["selected", "row-7"]]);
});
