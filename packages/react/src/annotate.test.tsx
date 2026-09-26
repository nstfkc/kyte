import { render } from "@testing-library/react";
import { expect, test } from "vitest";
import { getComponentAt, Wrapper } from "./Component";
import { Runtime } from "./Runtime";
import type { Catalog } from "./catalog";
import type { ApplicationDefinition } from "./schema";

// A page as kyte-app stores it: a thin root and a flat map of named components.
const page: ApplicationDefinition = {
  state: { features: { type: "array", value: ["Fast", "Small"] } },
  render: [["Page", {}, []]],
  components: {
    Page: { props: {}, render: [["Hero", {}, []], ["Features", {}, []]] },
    Hero: {
      props: {},
      // Two roots.
      render: [
        ["h1", { children: ["Title"] }, []],
        ["p", { children: ["Tagline"] }, [["em", { children: ["now"] }, []]]],
      ],
    },
    Features: {
      props: {},
      render: [
        [
          "section",
          {},
          [["$each", { data: ["$:features"] }, [["FeatureCard", { label: ["@"] }, []]]]],
        ],
      ],
    },
    FeatureCard: { props: {}, render: [["div", { children: ["#:label"] }, []]] },
  },
};

function renderAnnotated(definition: unknown, extra: { selectedComponent?: string; partial?: true } = {}, catalog?: Catalog) {
  return render(
    <Runtime catalog={catalog}>
      <Wrapper definition={definition as any} annotate {...(extra as any)} />
    </Runtime>,
  );
}

test("stamps each instance's root DOM nodes, innermost component first", () => {
  const { container } = renderAnnotated(page);
  expect(container.innerHTML).toBe(
    '<h1 data-kyte-component="Hero Page">Title</h1>' +
      // Nested elements win over the `children` prop.
      '<p data-kyte-component="Hero Page"><em>now</em></p>' +
      '<section data-kyte-component="Features Page">' +
      '<div data-kyte-component="FeatureCard">Fast</div>' +
      '<div data-kyte-component="FeatureCard">Small</div>' +
      "</section>",
  );
});

test("getComponentAt resolves a click target to the innermost component", () => {
  const { container } = renderAnnotated(page);
  const em = container.querySelector("em")!;
  const hero = getComponentAt(em);
  expect(hero?.name).toBe("Hero");
  expect(hero?.names).toEqual(["Hero", "Page"]);
  expect(hero?.element === container.querySelector("p")).toBe(true);
  const cards = container.querySelectorAll("section > div");
  const card = getComponentAt(cards[1]!);
  expect(card?.name).toBe("FeatureCard");
  expect(card?.element === cards[1]).toBe(true);
  expect(getComponentAt(container)).toBeNull();
  expect(getComponentAt(null)).toBeNull();
});

test("selectedComponent marks every instance's roots, including via outer names", () => {
  const { container } = renderAnnotated(page, { selectedComponent: "FeatureCard" });
  expect(container.querySelectorAll("[data-kyte-selected]")).toHaveLength(2);
  const outer = renderAnnotated(page, { selectedComponent: "Page" });
  expect(
    [...outer.container.querySelectorAll("[data-kyte-selected]")].map((n) => n.tagName),
  ).toEqual(["H1", "P", "SECTION"]);
});

test("catalog component roots receive the attribute as a prop", () => {
  const Card = (props: Record<string, unknown>) => <article {...props} />;
  const { container } = renderAnnotated(
    {
      state: {},
      render: [["Promo", {}, []]],
      components: { Promo: { props: {}, render: [["Card", { children: ["Hi"] }, []]] } },
    },
    {},
    { Card: { component: Card } },
  );
  expect(container.innerHTML).toBe('<article data-kyte-component="Promo">Hi</article>');
});

test("works in partial mode", () => {
  const text = JSON.stringify(page);
  const { container } = renderAnnotated(text.slice(0, text.indexOf('"Features":')), { partial: true });
  expect(container.innerHTML).toBe(
    '<h1 data-kyte-component="Hero Page">Title</h1><p data-kyte-component="Hero Page"><em>now</em></p>',
  );
});

test("adds nothing unless annotate is set", () => {
  const { container } = render(
    <Runtime>
      <Wrapper definition={page} selectedComponent="Hero" />
    </Runtime>,
  );
  expect(container.innerHTML).not.toContain("data-kyte");
});
