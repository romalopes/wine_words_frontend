/**
 * Normalise a list-like API value into `string[]`.
 *
 * Several legacy `t.text` columns (notably `wine_profiles.regions`,
 * `wine_profiles.grapes` and `wine_profiles.notes`) serialise as a
 * **JSON-encoded string** (`'["Barossa","Bordeaux"]'`) rather than a real
 * array, while sibling serializers (`WineSerializer#regions`) emit rich
 * `Region[]` objects. Consumers that `.map` the raw value crash with
 * `TypeError: ... .map is not a function` on the string shape (the `/quiz`
 * search crash) — so every shape is normalised here instead of at each
 * call site:
 *   - `Region[]`-style objects (`{ name }`)  -> their names
 *   - `string[]`                             -> as-is (stringified)
 *   - JSON-encoded string                    -> parsed, then as above
 *   - plain string (`"Barossa"`)             -> single-element list
 *   - null / undefined / anything else       -> `[]` (never throws)
 */
export function toStringList(value: unknown): string[] {
  if (value == null) return [];
  if (Array.isArray(value)) {
    return value.flatMap((item) => toNameOrString(item));
  }
  if (typeof value === "string") {
    const trimmed = value.trim();
    if (!trimmed) return [];
    try {
      const parsed: unknown = JSON.parse(trimmed);
      if (Array.isArray(parsed)) {
        return parsed.flatMap((item) => toNameOrString(item));
      }
      // Valid JSON but not a list (a bare string/number) — treat the raw
      // text as the single value rather than the parsed scalar, so `"42"`
      // keeps its original form.
      return [trimmed];
    } catch {
      // Not JSON at all (legacy free text) — keep it verbatim.
      return [trimmed];
    }
  }
  return [];
}

/** One list entry -> display string(s); objects resolve via `.name`. */
function toNameOrString(item: unknown): string[] {
  if (item == null) return [];
  if (typeof item === "string") {
    const trimmed = item.trim();
    return trimmed ? [trimmed] : [];
  }
  if (typeof item === "number" || typeof item === "boolean") {
    return [String(item)];
  }
  if (typeof item === "object") {
    const name = (item as { name?: unknown }).name;
    if (typeof name === "string" && name.trim()) return [name.trim()];
    return [];
  }
  return [];
}
