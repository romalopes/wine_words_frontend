import * as Sentry from "@sentry/react";
import type { FallbackRender } from "@sentry/react";
import { useEffect } from "react";

const SentryFallback: FallbackRender = ({ error, resetError }) => {
  // Add route context to Sentry scope for better filtering
  useEffect(() => {
    if (error) {
      const scope = Sentry.getCurrentScope();
      if (scope) {
        scope.setTag("route", window.location.pathname);
        scope.setExtra("boundaryError", error);
      }
    }
  }, [error]);

  const errorMessage = error instanceof Error ? error.message : String(error);
  const errorStack = error instanceof Error ? error.stack : undefined;

  return (
    <div style={styles.container}>
      <h1 style={styles.title}>Something went wrong</h1>
      {error != null && (
        <div style={styles.errorDetails}>
          <h2>Error:</h2>
          <pre style={styles.errorText}>{errorMessage}</pre>
          {/* Optional: Show stack trace in development */}
          {import.meta.env.DEV && errorStack && (
            <>
              <div style={styles.stackLabel}>Stack Trace:</div>
              <pre style={styles.stackText}>{errorStack}</pre>
            </>
          )}
        </div>
      )}
      <button onClick={resetError} style={styles.button}>
        Try Again
      </button>
    </div>
  );
};

export default SentryFallback;

const styles = {
  container: {
    padding: "2rem",
    textAlign: "center" as const,
    fontFamily: "system-ui, sans-serif",
  },
  title: {
    color: "#dc3545",
    marginBottom: "1.5rem",
  },
  errorDetails: {
    textAlign: "left" as const,
    maxWidth: "600px",
    margin: "0 auto 2rem",
  },
  errorText: {
    backgroundColor: "#f8f9fa",
    padding: "1rem",
    borderRadius: "4px",
    overflowX: "auto" as const,
  },
  stackLabel: {
    marginTop: "1rem",
    fontWeight: "bold",
    color: "#6c757d",
  },
  stackText: {
    backgroundColor: "#e9ecef",
    padding: "1rem",
    borderRadius: "4px",
    overflowX: "auto" as const,
    fontSize: "0.9rem",
  },
  button: {
    backgroundColor: "#0d6efd",
    color: "white",
    border: "none",
    padding: "0.75rem 1.5rem",
    borderRadius: "4px",
    cursor: "pointer",
    fontSize: "1rem",
  },
};
