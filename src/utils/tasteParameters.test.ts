import { tasteEndpoints, tasteLabel, tasteScoreText } from "./tasteParameters";

const acidity = {
  id: 1, slug: "acidity", label: "Acidity",
  labels: { "1": "Low", "2": "Medium (-)", "3": "Medium", "4": "Medium (+)", "5": "High" },
};

describe("taste parameters", () => {
  it("resolves labels and endpoint labels from the API payload", () => {
    expect(tasteLabel(acidity, 4)).toBe("Medium (+)");
    expect(tasteEndpoints(acidity)).toEqual(["Low", "High"]);
    expect(tasteScoreText(acidity, 4)).toBe("4 / 5 — Medium (+)");
  });
});