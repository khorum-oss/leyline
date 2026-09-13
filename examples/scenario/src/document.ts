import workspaceOnboarding from './workspace-onboarding.json' with { type: 'json' };

/**
 * The workflow, as it sits on disk.
 *
 * It is imported rather than built, because that is the claim: sequencing,
 * eligibility, and navigation are a serializable document, not code. Nothing in
 * this package constructs it, and nothing in the examples edits it — the control
 * plane does that at runtime, which is the whole demonstration.
 */
export const document: unknown = workspaceOnboarding;
