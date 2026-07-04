import { ComponentDefinition } from "./schema";

const staticText: ComponentDefinition = {
  props: {},
  state: {},
  render: [["div", { children: ["Hello world!"] }, []]],
};

const counter: ComponentDefinition = {
  props: {},
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
