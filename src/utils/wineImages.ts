/** Public Vite asset shown for wines that do not yet have an uploaded image. */
export const GENERAL_BOTTLE_IMAGE = "/general_bottle.jpg";

function firstUsableImage(images?: readonly (string | null | undefined)[]): string | null {
  return (
    images?.find(
      (image): image is string => typeof image === "string" && image.trim().length > 0,
    ) ?? null
  );
}

/**
 * Returns a wine's first uploaded image, falling back to the bundled bottle.
 * List responses provide `images`; detail responses can additionally provide
 * `primary_image`, so accept both while keeping the existing list ordering.
 */
export function wineImage(
  images?: readonly (string | null | undefined)[],
  primaryImage?: string | null,
): string {
  return firstUsableImage(images) ??
    (typeof primaryImage === "string" && primaryImage.trim().length > 0
      ? primaryImage
      : GENERAL_BOTTLE_IMAGE);
}

/** Preserve every uploaded wine image for galleries, or show one bottle fallback. */
export function wineImageGallery(images?: readonly (string | null | undefined)[]): string[] {
  const uploadedImages = images?.filter(
    (image): image is string => typeof image === "string" && image.trim().length > 0,
  ) ?? [];

  return uploadedImages.length > 0 ? uploadedImages : [GENERAL_BOTTLE_IMAGE];
}

/**
 * Review imagery takes precedence. If it has none, use its reviewed wine's
 * image; wines without uploads receive the bundled bottle image.
 */
export function reviewImage(
  reviewImages?: readonly (string | null | undefined)[],
  wineImageUrl?: string | null,
  primaryImage?: string | null,
): string {
  return firstUsableImage(reviewImages) ??
    (typeof wineImageUrl === "string" && wineImageUrl.trim().length > 0
      ? wineImageUrl
      : null) ??
    (typeof primaryImage === "string" && primaryImage.trim().length > 0
      ? primaryImage
      : GENERAL_BOTTLE_IMAGE);
}