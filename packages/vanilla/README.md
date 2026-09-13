# @leyline/vanilla

The direct DOM adapter, and the reference implementation for plain JavaScript.

This package doubles as proof that the core is genuinely headless (G5). It
renders a workflow with no framework at all, which is the only way to be certain
nothing framework-shaped leaked into the contract every other adapter depends
on.

See the [glossary](../../docs/glossary.md#the-runtime) for **store contract**,
**adapter**, and **render plan**.

## Mounting a workflow

```js
const stop = mount(workflow, { container: document.querySelector('#app') });
```

Each published snapshot replaces the container's contents outright. That is the
honest thing for a reference implementation: no diffing to get subtly wrong, and
the cost of not having a framework is visible rather than hidden. An application
that needs finer updates should reach for an adapter whose framework already
solved that.

## Writing a renderer

A renderer returns a DOM node:

```js
const actionsTable = ({ surface }) => {
  const table = document.createElement('table');
  for (const action of surface.data ?? []) {
    const row = document.createElement('tr');
    row.textContent = action.label;
    table.append(row);
  }
  return table;
};

const panel = ({ region, surfaces, regions }) => {
  const section = document.createElement('section');
  for (const slot of surfaces) section.append(slot.render());
  for (const slot of regions) section.append(slot.render());
  return section;
};
```

Same contract as the React and Svelte adapters, with `Node` where they have an
element or a component.

## The smallest bridge

`observe(store, render)` runs `render` with the current snapshot and again on
every change. It is the yardstick every other adapter is measured against: if
bridging the core to a framework takes much more than this, something belongs in
the core that is not there yet.
