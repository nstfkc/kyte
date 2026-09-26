import { expect, test } from "vitest";
import { operantArity } from "./operants";
import { validateExpression } from "./validate";

const DASH = '; for a dash in text write it as a literal inside "+": ["+", ["- "], <value>]';

const messages = (expr: unknown, scope = {}) => validateExpression(expr, scope).map((i) => i.message);

test("accepts what the compiler runs", () => {
  for (const expr of [
    ["hello"],
    [42],
    ["/"],
    ["$:count"],
    ["+", "Count: ", "$:count"],
    ["?", "$:open", "Hide", "Show"],
    [".", ["@"], ["name"]],
    ["_", [["+", "$:count", 1], "$$:count"]],
    ["_", [[".=", "$:form", ["email"], "@@"], "$$:form"]],
    ["_", ["+", "$:count", 1, "$$:count"]],
    ["_", ["$$:value"]],
    ["()", ["()", "fn:add", 1], 2],
    [["+", 1, 2]],
  ]) {
    expect(messages(expr), JSON.stringify(expr)).toEqual([]);
  }
});

test("rejects the model's invented expressions with specific messages", () => {
  expect(messages(["/", [["new", "Date"], []], "getFullYear"])).toEqual([
    "expected an operator at position 0, got [\"new\",\"Date\"] (a literal is a single-element array, e.g. [\"text\"])",
  ]);
  expect(messages(["@", []])).toEqual([
    'expected an operator at position 0, got "@" — to join text and values write ["+", part1, part2, ...]',
  ]);
  expect(messages(["/", 1, 2, 3])).toEqual(['"/" takes 2 arguments, got 3']);
  expect(messages(["!"])).toEqual([]);
  expect(messages(["!", 1, 2])).toEqual(['"!" takes 1 argument, got 2']);
  expect(messages(["+", "Home ", "/"])).toEqual([
    '"/" is an operator; to use it as text write ["/"], to apply it nest it: ["/", …]',
  ]);
  expect(messages([])).toEqual(["empty expression []; a literal is [value]"]);
  expect(messages(["$$:x", 1])).toEqual(['"$$:x" must come last: [<value>, "$$:x"]']);
  expect(messages(["+", null, { a: 1 }])).toHaveLength(2);
  expect(messages("text")).toEqual(['expected an expression (a JSON array), got "text"']);
});

test("reports nested issues with their path", () => {
  expect(validateExpression(["+", "a", ["-", 1]])).toEqual([
    { path: [2], message: '"-" takes 2 arguments, got 1' + DASH },
  ]);
});

test("checks token scope when told the scope", () => {
  const scope = { item: false, props: false, handler: false, state: new Set(["count"]) };
  expect(messages(["@"], scope)[0]).toMatch(/only exists inside a \$each/);
  expect(messages(["#:title"], scope)[0]).toMatch(/isn't inside a component/);
  expect(messages(["@@"], scope)[0]).toMatch(/only exists inside an event handler/);
  expect(messages([1, "$$:count"], scope)[0]).toMatch(/only works inside an event handler/);
  expect(messages(["$:nope"], scope)).toEqual(['unknown state "nope"; declare it in "state"']);
  expect(messages(["_", [["+", "$:count", 1], "$$:count"]], scope)).toEqual([]);
});

test("every operator has an arity", () => {
  for (const [op, arity] of Object.entries(operantArity)) {
    const args = Array.from({ length: arity }, () => 1);
    expect(messages([op, ...args]), op).toEqual([]);
  }
});

test("+ is variadic (2 or more arguments)", () => {
  expect(messages(["+", "© ", ["$:year"], " Acme. All rights reserved."])).toEqual([]);
  expect(messages(["_", ["+", "$:n", 1, 2, "$$:n"]])).toEqual([]);
  expect(messages(["+", "POST /v1/invoices"])).toEqual([]);
  expect(messages(["+", ["+"]])).toEqual([]);
});

test("text parts listed without an operator get a join hint", () => {
  expect(messages(['"', [".", ["#:t"], ["text"]], '"'])).toEqual([
    'expected an operator at position 0, got "\\"" — to join text and values write ["+", part1, part2, ...]',
  ]);
});

test("a dash meant as text gets a hint", () => {
  expect(messages(["-", [".", ["#:t"], ["name"]]])).toEqual(['"-" takes 2 arguments, got 1' + DASH]);
  expect(messages(["-", "— ", "$:name"])).toEqual(['"-" subtracts numbers' + DASH]);
  expect(messages(["-", "$:total", 5])).toEqual([]);
});
