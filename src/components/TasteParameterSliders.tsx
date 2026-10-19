import type { TasteParameter } from "../types/catalog";

interface TasteParameterSlidersProps {
  parameters: TasteParameter[];
  getScore: (parameter: TasteParameter, index: number) => number;
  onScoreChange: (
    parameter: TasteParameter,
    index: number,
    score: number,
  ) => void;
}

/**
 * Shared tasting-parameter slider UI used by wine and wine-profile forms.
 * Scores intentionally use the wine catalogue's 1–5 whole-number scale.
 */
function TasteParameterSliders({
  parameters,
  getScore,
  onScoreChange,
}: TasteParameterSlidersProps) {
  return (
    <div className="wine-form__section" data-component="taste-parameter-sliders">
      <div className="wine-form__vintages-header">
        <h2>Taste Parameters</h2>
      </div>
      <div className="wine-form__params">
        {parameters.map((parameter, index) => {
          const score = getScore(parameter, index);
          return (
            <label className="wine-slider" key={parameter.slug}>
              <span className="wine-slider__top">
                <strong>{parameter.label}</strong>
                <output>{score}</output>
              </span>
              <input
                max="5"
                min="1"
                type="range"
                value={score}
                onChange={(event) =>
                  onScoreChange(parameter, index, Number(event.target.value))
                }
              />
              <span className="wine-slider__scale">
                <small>{parameter.low}</small>
                <small>{parameter.high}</small>
              </span>
            </label>
          );
        })}
      </div>
    </div>
  );
}

export default TasteParameterSliders;