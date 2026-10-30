import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import AdaptiveImage from "./AdaptiveImage";

function setNaturalSize(image: HTMLImageElement, width: number, height: number) {
  Object.defineProperties(image, {
    naturalWidth: { configurable: true, value: width },
    naturalHeight: { configurable: true, value: height },
  });
}

describe("AdaptiveImage", () => {
  it("preserves a supplied class and marks portrait images", () => {
    render(<AdaptiveImage src="/portrait.jpg" alt="Bottle" className="hero" />);
    const image = screen.getByRole("img", { name: "Bottle" }) as HTMLImageElement;
    setNaturalSize(image, 600, 900);

    fireEvent.load(image);

    expect(image).toHaveClass("hero", "is-portrait");
  });

  it("marks square and wide images as landscape", () => {
    render(<AdaptiveImage src="/landscape.jpg" alt="Vineyard" />);
    const image = screen.getByRole("img", { name: "Vineyard" }) as HTMLImageElement;
    setNaturalSize(image, 900, 600);

    fireEvent.load(image);

    expect(image).toHaveClass("is-landscape");
  });

  it("ignores load events without natural dimensions and resets on src changes", async () => {
    const view = render(<AdaptiveImage src="/first.jpg" alt="Changing image" />);
    const image = screen.getByRole("img", { name: "Changing image" }) as HTMLImageElement;

    fireEvent.load(image);
    expect(image).not.toHaveAttribute("class");

    setNaturalSize(image, 400, 800);
    fireEvent.load(image);
    expect(image).toHaveClass("is-portrait");

    view.rerender(<AdaptiveImage src="/second.jpg" alt="Changing image" />);
    await waitFor(() => expect(image).not.toHaveAttribute("class"));
  });
});