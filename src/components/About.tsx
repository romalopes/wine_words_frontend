import { Link } from "react-router-dom";

function About() {
  return (
    <main className="about-page">
      <section>
        <p className="wine-kicker">About the model</p>
        <h1>A general tasting profile for future wine data.</h1>
        <p>
          The finder starts with broad sensory parameters: acidity, body,
          tannin, sweetness, alcohol warmth, and fruit intensity. Those values
          can be stored per wine style, grape, producer, region, or bottle when
          the app grows into a database-backed project.
        </p>
        <Link className="text-link" to="/">
          Back to Home
        </Link>
      </section>
    </main>
  );
}

export default About;
