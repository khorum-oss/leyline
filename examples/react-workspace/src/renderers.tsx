import type { RegionRenderer, SurfaceRenderer } from '@leyline/react';

/**
 * The application's components.
 *
 * Nothing here knows what a guard is or when it ran. A surface arrives with its
 * data attached and its presence already decided (AD6); these draw it.
 */

interface Action {
  id: string;
  label: string;
}

export const ActionsTable: SurfaceRenderer = ({ surface }) => (
  <table className="table">
    <tbody>
      {((surface.data ?? []) as Action[]).map((action) => (
        <tr key={action.id}>
          <td>{action.label}</td>
        </tr>
      ))}
    </tbody>
  </table>
);

export const CardGrid: SurfaceRenderer = ({ surface }) => (
  <ul className="cards">
    {((surface.data ?? []) as Action[]).map((action) => (
      <li key={action.id} className="card">
        {action.label}
      </li>
    ))}
  </ul>
);

export const MetricsPanel: SurfaceRenderer = ({ surface }) => {
  const metrics = (surface.data ?? {}) as Record<string, string | number>;
  return (
    <dl className="metrics">
      {Object.entries(metrics).map(([name, value]) => (
        <div key={name}>
          <dt>{name}</dt>
          <dd>{value}</dd>
        </div>
      ))}
    </dl>
  );
};

export const LinkButton: SurfaceRenderer = ({ surface }) => {
  const link = surface.getters['link']?.() as { onActivate: () => void } | undefined;
  return (
    <button type="button" className="link" onClick={() => link?.onActivate()}>
      {String(surface.props['label'] ?? surface.id)}
    </button>
  );
};

export const Panel: RegionRenderer = ({ region, surfaces, regions }) => (
  <section className="panel">
    {region.description ? <p className="caption">{region.description}</p> : null}
    {surfaces.map((slot) => (
      <div key={slot.id} className="surface">
        {slot.render()}
      </div>
    ))}
    {regions.map((slot) => (
      <div key={slot.id}>{slot.render()}</div>
    ))}
  </section>
);
