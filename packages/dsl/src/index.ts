/**
 * `@leyline/dsl` — the TypeScript builder that emits schema documents.
 *
 * The DSL produces the canonical document; it is not a second source of truth
 * (AD1). Its value lies in compile-time checking of node references, context
 * shape, and capability names (G3), after which the output goes through the
 * same validation as hand-written JSON.
 *
 * Delivery stage 5 fills this in, and the fixture corpus it validates against
 * is shared with the planned Kotlin DSL (brief §10): both must emit
 * byte-comparable documents for the same reference workflows.
 */

export const packageStatus = {
  package: '@leyline/dsl',
  deliveryStage: 5,
  status: 'planned',
} as const;
