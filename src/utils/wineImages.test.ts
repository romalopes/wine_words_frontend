import {
  GENERAL_BOTTLE_IMAGE,
  reviewImage,
  wineImage,
  wineImageGallery,
} from "./wineImages";

describe("wine image resolution", () => {
  it("uses the bundled bottle when a wine has no uploaded image", () => {
    expect(wineImage()).toBe(GENERAL_BOTTLE_IMAGE);
    expect(wineImage([])).toBe(GENERAL_BOTTLE_IMAGE);
    expect(wineImageGallery([])).toEqual([GENERAL_BOTTLE_IMAGE]);
  });

  it("keeps uploaded wine images and their gallery ordering", () => {
    expect(wineImage(["https://images.example.com/primary.jpg"])).toBe(
      "https://images.example.com/primary.jpg",
    );
    expect(wineImageGallery(["https://images.example.com/one.jpg", "https://images.example.com/two.jpg"])).toEqual([
      "https://images.example.com/one.jpg",
      "https://images.example.com/two.jpg",
    ]);
  });

  it("uses the bottle for a review only when it and its wine have no images", () => {
    expect(reviewImage([], null, null)).toBe(GENERAL_BOTTLE_IMAGE);
    expect(reviewImage([], "https://images.example.com/wine.jpg", null)).toBe(
      "https://images.example.com/wine.jpg",
    );
    expect(reviewImage(["https://images.example.com/review.jpg"], "https://images.example.com/wine.jpg")).toBe(
      "https://images.example.com/review.jpg",
    );
  });
});