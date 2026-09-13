# The §2 scenario, as data

The workflow every other example renders: create a workspace, settle billing
when the tier calls for it, arrive at a hub whose actions table, metrics panel,
and links are drawn by registered renderers.

Nothing here is about a framework. It is a document, the capabilities its names
refer to, the catalogue an application publishes, and the registrations it makes
at startup.

| file                        | what it holds                                            |
| --------------------------- | -------------------------------------------------------- |
| `workspace-onboarding.json` | the workflow — imported, never constructed               |
| `capabilities.ts`           | what the document's names refer to                       |
| `catalogue.ts`              | what a change is allowed to name, minus the components   |
| `start.ts`                  | binding, registration, and the two changes from brief §2 |

## Why this package exists

Three UI examples needed the same four things, and copying them three times
would have made each example look like it was doing more work than it is. The
constitution says the same thing about adapters: anything two of them have to
duplicate belongs somewhere shared.

The one thing that cannot be shared is what a renderer _draws_ — React hands
back an element, Svelte a component, the DOM adapter a node. So the catalogue
here carries every entry's id, description, and claims, and each example
supplies the components by id.

## The descriptions are load-bearing

Every catalogue entry and every surface in the document carries a description.
They are not comments. They are what an agent reads through `leyline_describe`
when it decides which surface to change and which renderer to name, and the
difference between a useful introspection result and a list of identifiers.
[`agent-cli`](../agent-cli) shows what an agent does with them.
