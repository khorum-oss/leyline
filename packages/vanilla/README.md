# @leyline/vanilla

The direct DOM adapter, and the reference implementation for plain JavaScript.

This package doubles as proof that the core is genuinely headless (G5). Anything
it cannot do without reaching into core internals marks a gap in the public
contract.

```js
const stop = observe(workflow, (snapshot) => {
  // render snapshot.surfaces through the registry
});
```

## Next — delivery stage 6

DOM mounting and the renderer registry.
