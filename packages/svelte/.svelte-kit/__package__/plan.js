import { FallbackRegion, FallbackSurface } from './fallback.js';
/**
 * Turns a render plan into slots a Svelte component can render.
 *
 * Svelte renders a dynamic component as `<Slot.component {...Slot.props} />`,
 * so a slot carries the component and its props rather than a render function.
 * That is the one real difference from the React adapter, and it is a
 * difference in how the framework mounts things rather than in what Leyline
 * decided.
 */
export function toRegionSlot(plan) {
    const component = plan.renderer?.component ?? FallbackRegion;
    const surfaces = plan.surfaces.map((entry) => {
        const props = { surface: entry.surface };
        return {
            id: entry.surface.id,
            type: entry.surface.type,
            component: entry.renderer?.component ?? FallbackSurface,
            props,
        };
    });
    const regions = plan.children.map((child) => toRegionSlot(child));
    return {
        id: plan.id,
        kind: plan.kind,
        ...(plan.description !== undefined ? { description: plan.description } : {}),
        component,
        props: {
            region: {
                id: plan.id,
                kind: plan.kind,
                ...(plan.description !== undefined ? { description: plan.description } : {}),
            },
            surfaces,
            regions,
        },
    };
}
