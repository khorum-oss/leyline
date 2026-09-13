import type { RegionRenderer, SurfaceRenderer } from '@leyline/vanilla';

/**
 * The application's renderers, with no framework underneath.
 *
 * A renderer hands back a `Node`. That is the entire contract, and writing these
 * is the honest measure of what a framework was doing for you: everything below
 * is `createElement` and `append`, and none of it is Leyline's business.
 *
 * Nothing here knows what a guard is or when it ran. A surface arrives with its
 * data attached and its presence already decided (AD6).
 */

interface Action {
  id: string;
  label: string;
}

const el = <K extends keyof HTMLElementTagNameMap>(
  tag: K,
  className?: string,
): HTMLElementTagNameMap[K] => {
  const node = document.createElement(tag);
  if (className !== undefined) node.className = className;
  return node;
};

export const ActionsTable: SurfaceRenderer = ({ surface }) => {
  const table = el('table', 'table');
  const body = el('tbody');
  for (const action of (surface.data ?? []) as Action[]) {
    const row = el('tr');
    const cell = el('td');
    cell.textContent = action.label;
    row.append(cell);
    body.append(row);
  }
  table.append(body);
  return table;
};

export const CardGrid: SurfaceRenderer = ({ surface }) => {
  const list = el('ul', 'cards');
  for (const action of (surface.data ?? []) as Action[]) {
    const item = el('li', 'card');
    item.textContent = action.label;
    list.append(item);
  }
  return list;
};

export const MetricsPanel: SurfaceRenderer = ({ surface }) => {
  const list = el('dl', 'metrics');
  for (const [name, value] of Object.entries((surface.data ?? {}) as Record<string, unknown>)) {
    const group = el('div');
    const term = el('dt');
    term.textContent = name;
    const detail = el('dd');
    detail.textContent = String(value);
    group.append(term, detail);
    list.append(group);
  }
  return list;
};

export const LinkButton: SurfaceRenderer = ({ surface }) => {
  // Behaviour arrives as a prop-getter rather than as a component the core
  // supplied (AD7). Leyline says what activating this link means; the element,
  // the class, and the listener are this application's business.
  const link = surface.getters['link']?.() as { onActivate: () => void } | undefined;
  const button = el('button', 'link');
  button.type = 'button';
  button.textContent = String(surface.props['label'] ?? surface.id);
  button.addEventListener('click', () => link?.onActivate());
  return button;
};

export const TextBlock: SurfaceRenderer = ({ surface }) => {
  const paragraph = el('p', 'text');
  paragraph.textContent = String(surface.props['value'] ?? '');
  return paragraph;
};

export const Panel: RegionRenderer = ({ region, surfaces, regions }) => {
  const section = el('section', 'panel');
  if (region.description !== undefined) {
    const caption = el('p', 'caption');
    caption.textContent = region.description;
    section.append(caption);
  }
  for (const slot of surfaces) {
    const wrapper = el('div', 'surface');
    wrapper.append(slot.render());
    section.append(wrapper);
  }
  for (const slot of regions) section.append(slot.render());
  return section;
};
