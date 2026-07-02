// Grammar rules (kept deliberately simple):
//  - Sigils:   "$x" read state, "$$x" mutate state, "@event" ambient handler ctx.
//  - Operators are INFIX at index 1 ("$count % 2"), except prefix forms whose op
//    is at index 0 ("?:" ternary). One operator table drives both.
//  - NO precedence: a flat array holds at most ONE operator. Anything with a
//    second operator must be NESTED, so the interpreter stays a dumb recursive
//    eval() instead of a Pratt parser.
//  - Node = [tag, props?, children?]. props and children are both OPTIONAL.
const app = {
  state: {
    count: {
      kind: "number",
      default: 0,
    },
    query: {
      kind: "string",
      default: "",
    },
  },
  effects: [],
  render: [
    "div",
    {
      // ternary with an EXPLICIT condition — no implicit pipe, no adjacency magic.
      className: [["?:", ["$count", "%", 2], "bg-red-200", "bg-blue-200"]],
    },
    [
      // "+" on a $$ target is read-modify-write: count := count + 1
      ["button", { onClick: ["$$count", "+", 1] }, ["$count"]],
      //
      [
        "input",
        {
          // controlled: value flows back in from state
          value: ["$query"],
          // ":=" is plain assign; the "^^" property chain is NESTED so the outer
          // array has only one operator (no := / ^^ precedence question).
          onChange: ["$$query", ":=", ["@0", "^^", "target", "^^", "value"]],
        },
        // children slot omitted — void element, and children are optional.
      ],
    ],
  ],
};
