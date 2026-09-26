import { render } from "@testing-library/react";
import { expect, test } from "vitest";
import { Wrapper } from "./Component";
import { Runtime } from "./Runtime";
import { parsePartialDefinition } from "./partial";
import { validateDefinition } from "./validate";
import { createUpgrader, FORMAT_VERSION, upgradeDefinition } from "./version";

const page = { state: {}, render: [["p", { children: "hi" }, []]] };

test("unversioned and current definitions pass through unchanged", () => {
  expect(upgradeDefinition(page)).toBe(page);
  const current = { ...page, version: FORMAT_VERSION };
  expect(upgradeDefinition(current)).toBe(current);
  expect(validateDefinition(current)).toEqual([]);
});

test("migrations run in order from the stored version and stamp the current one", () => {
  const upgrade = createUpgrader(
    {
      1: (d) => ({ ...d, log: [...((d.log as string[]) ?? []), "1→2"] }),
      2: (d) => ({ ...d, log: [...((d.log as string[]) ?? []), "2→3"] }),
    },
    3,
  );
  expect(upgrade({ ...page, version: 1 })).toEqual({ ...page, log: ["1→2", "2→3"], version: 3 });
  expect(upgrade({ ...page, version: 2 })).toEqual({ ...page, log: ["2→3"], version: 3 });
  const newer = { ...page, version: 4 };
  expect(upgrade(newer)).toBe(newer);
});

test("the validator rejects newer, outdated and malformed versions", () => {
  const message = (version: unknown) => validateDefinition({ ...page, version })[0]?.message;
  expect(message(FORMAT_VERSION + 1)).toBe(
    `version ${FORMAT_VERSION + 1} is newer than this kyte supports (${FORMAT_VERSION}); upgrade kyte`,
  );
  expect(message("1")).toMatch(/positive integer/);
  expect(message(0)).toMatch(/positive integer/);
});

test("parsePartialDefinition keeps the version and the Wrapper renders versioned input", () => {
  expect(parsePartialDefinition({ ...page, version: FORMAT_VERSION }).version).toBe(FORMAT_VERSION);
  expect(parsePartialDefinition(page)).not.toHaveProperty("version");
  const { container } = render(
    <Runtime>
      <Wrapper definition={{ ...page, version: FORMAT_VERSION } as any} />
    </Runtime>,
  );
  expect(container.innerHTML).toBe("<p>hi</p>");
});
