# Examples

Four packages, all `private`, none of them published, and nothing under
`packages/` refers to any of them. CI builds and runs them so they cannot rot
quietly, and that is the whole of their relationship with the library.

|                                          | what it shows                                                                    |
| ---------------------------------------- | -------------------------------------------------------------------------------- |
| [`scenario`](scenario)                   | the §2 workflow as data — shared by the three below                              |
| [`react-workspace`](react-workspace)     | the workflow in a React application                                              |
| [`svelte-workspace`](svelte-workspace)   | the same workflow in Svelte                                                      |
| [`vanilla-workspace`](vanilla-workspace) | the same workflow with no framework at all                                       |
| [`agent-cli`](agent-cli)                 | the same workflow driven by an agent — scripted, interactive, or by a real model |

## The point of having three UI examples

They render **the same document**, bound to **the same capabilities**, through
**the same control plane**, publishing **the same catalogue**. All of that lives
in [`scenario`](scenario), which is why each application is small.

What is left in each one is the part that is genuinely about its framework:

|         | a renderer is                   | a region's children arrive as            |
| ------- | ------------------------------- | ---------------------------------------- |
| React   | a function returning an element | slots with a `render()` function         |
| Svelte  | a component                     | slots carrying a component and its props |
| vanilla | a function returning a `Node`   | slots with a `render()` function         |

Svelte differs because Svelte mounts a dynamic component rather than calling a
render function. That is a fact about Svelte, not a decision Leyline made — and
it is the only difference of substance between the three.

Open `App.tsx`, `App.svelte`, and `main.ts` side by side. If the differences ever
grow past reactivity and mounting, something has leaked out of the core.

## Running them

```bash
pnpm --filter @leyline-examples/react-workspace dev
pnpm --filter @leyline-examples/svelte-workspace dev
pnpm --filter @leyline-examples/vanilla-workspace dev

# No browser, no API key, no network:
pnpm --filter @leyline-examples/agent-cli demo
```
