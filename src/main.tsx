import "bootstrap/dist/css/bootstrap.min.css";
import * as Sentry from "@sentry/react";
import "./index.css";
import "./App.css";
import SentryFallback from "./components/SentryFallback";

import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App";

const rootElement = document.getElementById("root");

if (!rootElement) {
  throw new Error("Root element #root was not found in index.html");
}

if (import.meta.env.PROD && import.meta.env.VITE_SENTRY_DSN) {
  Sentry.init({
    dsn: import.meta.env.VITE_SENTRY_DSN,
    integrations: [
      Sentry.browserTracingIntegration(),
      Sentry.replayIntegration(), // Captures video-like session replays for crashes
    ],
    // 1. Drop performance tracing significantly
    tracesSampleRate: 0.05, // 10% (or even 0.05 / 5% for very high traffic)
    // 2. Keep normal session replays low to save bandwidth and storage
    replaysSessionSampleRate: 0.01, // 1%
    // 3. Always capture 100% of sessions when something breaks
    replaysOnErrorSampleRate: 1.0, // 100% of sessions with errors
  });
}

createRoot(rootElement).render(
  <StrictMode>
    <Sentry.ErrorBoundary fallback={<SentryFallback />}>
      <App />
    </Sentry.ErrorBoundary>
  </StrictMode>,
);
