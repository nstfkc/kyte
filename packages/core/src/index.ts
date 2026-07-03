const operants = {
  "+": (a: (p: any) => number) => (b: (p: any) => number) => (p: any) => a(p) + b(p),
  pick: (obj: (p: any) => Record<string, any>) => (key: (p: any) => string) => (p: any) =>
    obj(p)[key(p)],
};

function isOperant(token: any): token is Operant {
  return typeof token === "string" && token in operants;
}

function isArgPlaceholder(token: any): token is ArgPlaceholder {
  return typeof token === "string" && token.startsWith("@");
}

function isReference(token: any): token is string {
  if (typeof token !== "string") return false;
  const [prefix] = token.split(":");
  return prefix === "#";
}

type Operant = keyof typeof operants;
type ArgPlaceholder = `@:${string}`;
type Expr = Array<ArgPlaceholder | Operant | number | string | Expr>;

const state: Record<string, any> = { count: 2 };

function createParser(references: Record<string, any>) {
  return function parse(exp: Expr) {
    let result: any = (fn: (arg: any) => any) => fn;
    for (const token of exp) {
      if (isOperant(token)) {
        result = result(operants[token]);
        continue;
      }
      if (isArgPlaceholder(token)) {
        result = result((p: any) => p);
        continue;
      }
      if (isReference(token)) {
        const [, name] = token.split(":");
        result = result(() => references[name as any]);
        continue;
      }
      if (Array.isArray(token)) {
        result = result(parse(token));
        continue;
      }
      result = result(() => token);
    }
    return result;
  };
}

const parse = createParser({ state });
// The parsed expression IS the handler: a function of one arg `p` (the event or
// prev value), supplied by the caller when the handler fires. No sink needed.
const result = parse(["+", ["pick", "#:state", "count"], "@"]);

console.log(result(3)); // Output: 5  (3 + state.count)

// const result = parse(["@:count", ["+", 1], "_"])(5); // should return () => 6
// console.log(result()); // Output: 6

// a => b => a() + b()
// () => 2
// (p) => p

// p => (fn) => fn(p)
// fn = (a) => (b) => a() + b()
// fn(() => 3) = (b) => 3 + b() => b = ()=>2
