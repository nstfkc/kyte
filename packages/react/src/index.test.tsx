import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { expect, test, vi } from "vitest";
import { Wrapper } from "./Component";
import { Runtime } from "./Runtime";
import type { ComponentDefinition } from "./schema";

// Render a definition into a real DOM via <Wrapper>, wrapped in the Runtime
// provider it depends on. Returns the Testing Library render result.
function renderDefinition(definition: ComponentDefinition) {
  return render(
    <Runtime>
      <Wrapper definition={definition} />
    </Runtime>,
  );
}

const empty = { state: {}, props: {} };

test("renders an element using its tag", () => {
  const { container } = renderDefinition({ ...empty, render: [["div", {}, []]] });
  expect(container.innerHTML).toBe("<div></div>");
});

test("evaluates attribute expressions into props", () => {
  const { container } = renderDefinition({
    ...empty,
    render: [["div", { id: ["box"], "data-sum": ["+", 1, 2], children: ["Hello world!"] }, []]],
  });
  expect(container.innerHTML).toBe('<div id="box" data-sum="3">Hello world!</div>');
});

test("renders nested elements from the children slot", () => {
  const { container } = renderDefinition({
    ...empty,
    render: [["ul", {}, [["li", {}, []]]]],
  });
  expect(container.innerHTML).toBe("<ul><li></li></ul>");
});

test("renders multiple root elements", () => {
  const { container } = renderDefinition({
    ...empty,
    render: [
      ["p", {}, []],
      ["span", {}, []],
    ],
  });
  expect(container.innerHTML).toBe("<p></p><span></span>");
});

test("wires up an interactive handler referenced from props", async () => {
  const user = userEvent.setup();
  const onClick = vi.fn();

  renderDefinition({
    state: {},
    // The handler lives in `props`; the expression references it by name.
    // (`props` is currently typed as an empty object, so cast through unknown.)
    props: { onClick } as unknown as ComponentDefinition["props"],
    render: [["button", { onClick: ["pick", ["#:props"], ["onClick"]], children: ["Click me"] }, []]],
  });

  await user.click(screen.getByRole("button", { name: "Click me" }));

  expect(onClick).toHaveBeenCalledTimes(1);
});
