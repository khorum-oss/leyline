# @leyline/react

The React reactivity bridge.

Adapters stay thin (G5). `useLeylineStore` bridges the core's store contract to
`useSyncExternalStore`, and nothing else here knows anything about workflows.
Snapshots carry structural sharing (AD4), so identity comparison is a valid
change check and no equality function is needed.

```tsx
const snapshot = useLeylineStore(workflow);
```

## Next — delivery stage 3

The ranked renderer registry (AD5) and `WorkflowView`, proving the brief's §2
scenario (items 1–5) end to end.
