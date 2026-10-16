import { Link } from "react-router-dom";
import type { AboutHeroData } from "../../types/about";
import styles from "./AboutPage.module.css";

function AboutHero({ hero }: { hero: AboutHeroData }) {
  return (
    <header className={styles.hero}>
      <p className={`wine-kicker ${styles.heroKicker}`}>About</p>
      <h1 className={styles.heroTitle}>{hero.title}</h1>
      <p className={styles.heroSubtitle}>{hero.subtitle}</p>
      <blockquote className={styles.heroQuote}>“{hero.quote}”</blockquote>
      <div className={styles.heroActions}>
        <Link className={styles.primaryButton} to={hero.primaryCta.to}>
          {hero.primaryCta.label}
        </Link>
        <Link className={styles.secondaryButton} to={hero.secondaryCta.to}>
          {hero.secondaryCta.label}
        </Link>
      </div>
    </header>
  );
}

export default AboutHero;
