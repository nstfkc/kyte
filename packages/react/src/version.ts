// The ApplicationDefinition format version this library reads and writes.
// Bump it when a change alters what an existing definition means, and register
// a migration from the previous version below. Additive changes (new operators,
// directives, looser input) don't need a bump.
export const FORMAT_VERSION = 1;

type Definition = Record<string, unknown>;

// `migrations[n]` rewrites a version-n definition into version n + 1.
export type Migrations = Record<number, (definition: Definition) => Definition>;

const MIGRATIONS: Migrations = {};

const isObject = (value: unknown): value is Definition =>
  typeof value === "object" && value !== null && !Array.isArray(value);

export function createUpgrader(migrations: Migrations, current: number) {
  return (definition: unknown): unknown => {
    if (!isObject(definition)) return definition;
    const { version } = definition;
    // Unversioned means current: that's what a model emits. Store definitions
    // with `version` so they can be upgraded later.
    if (version === undefined || version === current) return definition;
    // Newer or malformed: leave as is (validateDefinition reports it).
    if (typeof version !== "number" || !Number.isInteger(version) || version > current) {
      return definition;
    }
    let upgraded = definition;
    for (let from = Math.max(version, 1); from < current; from++) {
      const migrate = migrations[from];
      if (migrate) upgraded = migrate(upgraded);
    }
    return { ...upgraded, version: current };
  };
}

// Bring a stored definition up to FORMAT_VERSION by running the migrations
// from its `version`. Unversioned, current, newer or non-object input is
// returned unchanged. Wrapper and parsePartialDefinition apply this already;
// call it yourself before strict-validating stored data.
export const upgradeDefinition: (definition: unknown) => unknown = createUpgrader(
  MIGRATIONS,
  FORMAT_VERSION,
);
