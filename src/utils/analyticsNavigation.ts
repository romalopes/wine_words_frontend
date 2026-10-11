/** Navigation context detection for analytics. */

export interface NavigationContext {
  source: "direct" | "search" | "internal" | "external";
  referrer?: string | undefined;
  fromContentType?: "Wine" | "Article" | "Review" | undefined;
  fromContentId?: string | undefined;
}

/**
 * Detect navigation context for the current page view.
 * Allowlisted transitions (Phase 1 scope):
 * - Wine detail → Review detail (via "View Review" link)
 * - Article detail → Review detail (via linked review card)
 */
export function getNavigationContext(): NavigationContext {
  if (typeof document === "undefined") return { source: "direct" };

  const referrer = document.referrer || undefined;
  let source: NavigationContext["source"] = "direct";

  if (referrer) {
    try {
      const referrerUrl = new URL(referrer);
      const currentHost = window.location.host;
      if (referrerUrl.host === currentHost) {
        source = "internal";
      } else if (isSearchEngine(referrerUrl.host)) {
        source = "search";
      } else {
        source = "external";
      }
    } catch {
      source = "external";
    }
  }

  // Detect Wine→Review or Article→Review transitions from current path
  let fromContentType: NavigationContext["fromContentType"];
  let fromContentId: NavigationContext["fromContentId"];

  const pathMatch = window.location.pathname.match(/^\/(wines|articles|reviews)\/([^/]+)/);
  if (pathMatch) {
    const [, type, id] = pathMatch;
    fromContentType = capitalizeFirst(type?.slice(0, -1)) as NavigationContext["fromContentType"]; // "wines" → "Wine"
    fromContentId = id;
  }

  return { source, referrer, fromContentType, fromContentId };
}

function isSearchEngine(host: string): boolean {
  const searchEngines = ["google", "bing", "duckduckgo", "yahoo", "baidu", "yandex"];
  return searchEngines.some((engine) => host.includes(engine));
}

function capitalizeFirst(str: string | undefined): string {
  if (!str) return "";
  return str.charAt(0).toUpperCase() + str.slice(1);
}