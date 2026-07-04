import { ApplicationDefinition } from "./schema";

const staticText: ApplicationDefinition = {
  state: {},
  render: [["div", { children: ["Hello world!"] }, []]],
};

const counter: ApplicationDefinition = {
  state: {
    count: { type: "number", initialValue: [0] },
  },
  render: [
    [
      "div",
      [
        ["span", { children: ["Count: ", "$:count"] }, []],
        [
          "button",
          {
            onClick: ["_", [["+", "$:count", 1], "$$:count"]],
            children: ["Increment"],
          },
          [],
        ],
      ],
    ],
  ],
};
