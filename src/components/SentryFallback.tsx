import { useRouteError } from "react-router-dom";
import * as Sentry from "@sentry/react";
import { useEffect } from "react";

export default function SentryFallback() {
  // Get error from Sentry boundary (for component errors)
  // @ts-ignore - useSentryError may not be available in all versions
  const sentryError = (Sentry as any).useSentryError ? (Sentry as any).useSentryError() : null;
  
  // Get error from React Router (for loader/action errors)
  const routerError = useRouteError();
  
  // Determine which error to display
  const error = sentryError || routerError;
  
  // Add route context to Sentry scope for better filtering
  useEffect(() => {
    if (error) {
      const scope = Sentry.getCurrentScope();
      if (scope) {
        scope.setTag("route", window.location.pathname);
        scope.setExtra("routerError", routerError);
      }
    }
  }, [error, routerError]);
  
  return (
    <div style={styles.container}>
      <h1 style={styles.title}>Something went wrong</h1>
      {error && (
        <div style={styles.errorDetails}>
          <h2>Error:</h2>
          <pre style={styles.errorText}>{error.message || String(error)}</pre>
          {/* Optional: Show stack trace in development */}
          {(import.meta as any).env.DEV && error.stack && (
            <>
              <div style={styles.stackLabel}>Stack Trace:</div>
              <pre style={styles.stackText}>{error.stack}</pre>
            </>
          )}
        </div>
      )}
      <button 
        onClick={() => window.location.reload()}
        style={styles.button}
      >
        Try Again
      </button>
    </div>
  );
}

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