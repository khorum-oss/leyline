# @leyline/react

The React adapter.

Adapters stay thin (G5). This package bridges the core's store contract to
React's own subscription primitive and hands each resolved surface and region to
whichever component claimed it. No workflow logic lives here; if it ever needs
some, that is a defect in the core rather than a cost of supporting React.

See the [glossary](../../docs/glossary.md#the-runtime) for **store contract**,
**snapshot**, **slot**, and **region renderer**.

## Rendering a workflow

```tsx
<WorkflowView workflow={workflow} />
```

That is the whole component surface. It subscribes through
`useSyncExternalStore`, so a snapshot published by the core reaches React the
way any external store does. Snapshots share structure (AD4), so an unchanged
region is the same object and React skips it with no equality function.

## Writing a renderer

A surface renderer receives the surface, with its guard already evaluated and
its data source already attached:

```tsx
const ActionsTable: SurfaceRenderer = ({ surface }) => (
  <table>
    <tbody>
      {(surface.data as Action[]).map((action) => (
        <tr key={action.id}>
          <td>{action.label}</td>
        </tr>
      ))}
    </tbody>
  </table>
);
```

A region renderer receives named slots and decides where each goes:

```tsx
const TwoColumn: RegionRenderer = ({ surfaces, regions }) => {
  const aside = regions.find((slot) => slot.id === 'navigation');
  const rest = regions.filter((slot) => slot.id !== 'navigation');
  return (
    <div className="columns">
      <aside>{aside?.render()}</aside>
      <main>
        {surfaces.map((slot) => (
          <Fragment key={slot.id}>{slot.render()}</Fragment>
        ))}
        {rest.map((slot) => (
          <Fragment key={slot.id}>{slot.render()}</Fragment>
        ))}
      </main>
    </div>
  );
};
```

Slots are functions rather than elements, so a renderer that does not use one
does not draw it, and arrangement stays entirely with the component
([decision 0030](../../docs/decisions/0030-react-rendering-contract.md)).

## Publishing renderers

Components reach Leyline through the catalogue, and registrations go through the
control plane like every other change:

```ts
const workflow = createWorkflow(document, capabilities, {
  mode: 'development',
  renderers: [
    ...FALLBACK_RENDERERS,
    { id: 'ActionsTable', claims: ['datatable'], component: ActionsTable },
  ],
});

await workflow.control.apply(
  await workflow.control.propose(
    {
      kind: 'renderer.register',
      registry: 'default',
      renderer: 'ActionsTable',
      match: { surfaceType: 'datatable' },
      rank: 10,
    },
    { kind: 'application' },
  ),
);
```

A change may name a catalogue entry and nothing else, which is what stops an
initiator supplying a component (I3). Registering a higher-ranked entry for one
surface is how "swap the actions table for a card grid" happens without the
workflow document changing.

## Unclaimed surfaces

Nothing claiming a surface draws a placeholder and reports `surface.unresolved`
on the trace stream. It never throws — which is what lets a deployed build read
a document containing surface types it has never heard of (AD8).

Register a renderer claiming `*` at rank 0 to replace the built-in placeholder
with your own.

## See it running

[`examples/react-workspace`](../../examples/react-workspace) is the brief's §2
scenario as an application, with buttons that drive the control plane the way an
agent would.
