export * from "@kyte/core";
export * from "@kyte/react";

// Both packages export a `Runtime` (a core type vs. the react provider
// component). Prefer the react component here; the core type stays reachable
// via `@kyte/core` directly.
export { Runtime } from "@kyte/react";

/**
 * The current version of the kyte umbrella package.
 */
export const version = "0.0.0";
