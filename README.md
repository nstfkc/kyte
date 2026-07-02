# kyte

A Turborepo + Bun monorepo for the `@kyte/*` libraries and their sandboxes.

## Package layout

```
kyte/
├── packages/
│   ├── core     # @kyte/core   — core library
│   ├── react    # @kyte/react  — React bindings
│   └── kyte     # kyte         — top-level umbrella package
└── sandbox/
    └── react    # local playground app for the React bindings
```

All library packages are published under the `@kyte/*` scope, are ESM-only
(`"type": "module"`), and share a strict TypeScript config via
`tsconfig.base.json`. Cross-package dependencies use the workspace protocol
(e.g. `"@kyte/core": "workspace:*"`).

## Requirements

- [Bun](https://bun.sh) v1.3.11+

## Getting started

Install all workspace dependencies:

```sh
bun install
```

Build every package (via Turborepo):

```sh
bun run build
```

Run the dev tasks across the workspace:

```sh
bun run dev
```

## Other scripts

| Script              | Description                        |
| ------------------- | ---------------------------------- |
| `bun run lint`      | Lint all packages                  |
| `bun run typecheck` | Type-check all packages            |
| `bun run clean`     | Remove build artifacts             |
