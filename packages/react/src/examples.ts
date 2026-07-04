import { ApplicationDefinition } from "./schema";

export const staticText: ApplicationDefinition = {
  state: {},
  render: [["div", { children: ["Hello world!"] }, []]],
};

export const counter: ApplicationDefinition = {
  state: {
    count: { type: "number", value: 0 },
  },
  render: [
    [
      "div",
      {},
      [
        ["span", { children: ["+", "Count: ", "$:count"] }, []],
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
