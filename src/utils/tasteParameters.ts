import type { TasteParameter } from "../types/catalog";

export function tasteLabel(parameter: TasteParameter, score: number): string | null {
  return parameter.labels?.[String(score)] ?? null;
}

export function tasteEndpoints(parameter: TasteParameter): [string, string] {
  return [tasteLabel(parameter, 1) ?? parameter.low ?? "1", tasteLabel(parameter, 5) ?? parameter.high ?? "5"];
}

export function tasteScoreText(parameter: TasteParameter, score: number): string {
  const label = tasteLabel(parameter, score);
  return label ? `${score} / 5 — ${label}` : `${score} / 5`;
}