/// <reference types="vite/client" />
/// <reference types="vitest" />
/// <reference types="vitest/globals" />
/// <reference types="vite-plugin-pwa/client" />

import type {
  AppleSdk,
  FacebookSdk,
  GoogleSdk,
  MsalSdk,
} from "./types/socialAuth"

declare global {
  /**
   * Each social SDK is loaded on demand from its own CDN and installs its own
   * global. They are declared here (rather than cast at each use site) so
   * `waitForGlobal` can resolve them by name. Every one of them is optional:
   * the script has not loaded until the corresponding sign-in is attempted.
   */
  interface Window {
    google?: GoogleSdk
    AppleID?: AppleSdk
    msal?: MsalSdk
    FB?: FacebookSdk
  }
}

interface ImportMetaEnv {
  readonly VITE_API_BASE_URL?: string
  readonly VITE_GOOGLE_CLIENT_ID?: string
  readonly VITE_APPLE_CLIENT_ID?: string
  readonly VITE_APPLE_REDIRECT_URI?: string
  readonly VITE_MICROSOFT_CLIENT_ID?: string
  readonly VITE_MICROSOFT_TENANT_ID?: string
  readonly VITE_FACEBOOK_APP_ID?: string
  readonly VITE_FACEBOOK_GRAPH_VERSION?: string
  /** Issue #201, Phase 1 — enable the mobile bottom navigation shell. */
  readonly VITE_MOBILE_LAYOUT_ENABLED?: string
  /** Issue #201, Phase 4 — register the generated PWA service worker. */
  readonly VITE_PWA_ENABLED?: string
  /** Issue #201, Phase 5 — enable IndexedDB repositories and offline UX. */
  readonly VITE_OFFLINE_ENABLED?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}

export {}

