import { useEffect, useState } from "react";
import { configurationApi } from "../services/api";
import type { Configuration } from "../types/notification";

interface UseConfigurationResult {
  configuration: Configuration | null;
  loading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
}

let configurationCache: Configuration | null = null;
let cachePromise: Promise<Configuration> | null = null;

/**
 * Hook to fetch and cache the global configuration.
 * The configuration is cached globally so multiple components can use it without
 * making duplicate API requests.
 */
export function useConfiguration(): UseConfigurationResult {
  const [configuration, setConfiguration] = useState<Configuration | null>(configurationCache);
  const [loading, setLoading] = useState(!configurationCache);
  const [error, setError] = useState<string | null>(null);

  const fetchConfiguration = async () => {
    // If we already have a pending request, wait for it
    if (cachePromise) {
      try {
        const config = await cachePromise;
        setConfiguration(config);
        return;
      } catch (err) {
        // If the cached promise failed, clear it so we can retry
        cachePromise = null;
      }
    }

    // Create a new fetch promise
    cachePromise = (async () => {
      const config = await configurationApi.fetch();
      configurationCache = config;
      return config;
    })();

    try {
      const config = await cachePromise;
      setConfiguration(config);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load configuration");
      configurationCache = null;
      cachePromise = null;
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!configurationCache && !cachePromise) {
      fetchConfiguration();
    } else if (configurationCache) {
      setConfiguration(configurationCache);
      setLoading(false);
    }
  }, []);

  return { configuration, loading, error, refetch: fetchConfiguration };
}

/**
 * Helper to check if taste parameters should be shown.
 * Defaults to true if configuration is not loaded or setting is not set.
 */
export function useShowTasteParameters(): boolean {
  const { configuration, loading } = useConfiguration();

  // If still loading, default to true to avoid flash of hidden content
  if (loading) return true;

  // Default to true if setting is not explicitly set
  return configuration?.show_taste_parameters ?? true;
}