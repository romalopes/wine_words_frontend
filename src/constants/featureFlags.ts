/**
 * Build-time feature flags.
 *
 * Vite inlines `import.meta.env.VITE_*` at build time, so these are constant in
 * a deployed bundle. The mobile shell ships dark: it renders only when the
 * deploy explicitly sets `VITE_MOBILE_LAYOUT_ENABLED=true`, letting the
 * responsive shell be verified on a preview without changing production
 * behaviour (issue #201, Phase 1).
 */
export function isMobileLayoutEnabled(): boolean {
  return import.meta.env.VITE_MOBILE_LAYOUT_ENABLED === "true"
}

export function isOfflineEnabled(): boolean {
  return import.meta.env.VITE_OFFLINE_ENABLED === "true"
}

/** Mobile breakpoint in px — mirrors the `@media (max-width: 768px)` rule. */
export const MOBILE_BREAKPOINT_PX = 768
