---
'@khorum-oss/leyline-svelte': patch
---

`@khorum-oss/leyline-svelte`: the package now ships the type declarations it always claimed
to. `package.json` pointed `types` at `./dist/index.d.ts`, and `svelte-package`
was emitting no `.d.ts` files at all — so every TypeScript consumer of the
published package silently got `any`.

Without an explicit `--tsconfig`, svelte2tsx looks for one inside the _input_
directory, fails to find `src/lib/tsconfig.json`, and the entire types step fails
without a warning. The build now names `tsconfig.package.json`, which also widens
`include` to cover `.svelte` files and turns off `noEmitOnError` for the emit
pass — correctness is gated by `tsc --build` and `svelte-check`, and a complaint
from the shim-based pass would otherwise suppress every declaration.

Found by pointing a new Svelte example at the built package.
