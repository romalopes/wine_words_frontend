import { useCallback, useRef } from "react";
import type { AboutTab, AboutTabData } from "../../types/about";
import styles from "./AboutPage.module.css";

interface AboutTabsProps {
  tabs: AboutTabData[];
  activeTab: AboutTab;
  onChange: (tab: AboutTab) => void;
}

function AboutTabs({ tabs, activeTab, onChange }: AboutTabsProps) {
  const tabRefs = useRef<(HTMLButtonElement | null)[]>([]);

  const handleKeyDown = useCallback(
    (event: React.KeyboardEvent<HTMLButtonElement>) => {
      const currentIndex = tabs.findIndex((tab) => tab.id === activeTab);
      let nextIndex: number | null = null;

      if (event.key === "ArrowRight" || event.key === "ArrowDown") {
        nextIndex = (currentIndex + 1) % tabs.length;
      } else if (event.key === "ArrowLeft" || event.key === "ArrowUp") {
        nextIndex = (currentIndex - 1 + tabs.length) % tabs.length;
      } else if (event.key === "Home") {
        nextIndex = 0;
      } else if (event.key === "End") {
        nextIndex = tabs.length - 1;
      }

      if (nextIndex !== null) {
        event.preventDefault();
        const nextTab = tabs[nextIndex];
        if (nextTab) onChange(nextTab.id);
        tabRefs.current[nextIndex]?.focus();
      }
    },
    [tabs, activeTab, onChange],
  );

  return (
    <nav className={styles.tabsNav} aria-label="About page sections">
      <div role="tablist" aria-label="About page sections" className={styles.tablist}>
        {tabs.map((tab, index) => {
          const isActive = tab.id === activeTab;
          return (
            <button
              key={tab.id}
              ref={(node) => {
                tabRefs.current[index] = node;
              }}
              id={`about-tab-${tab.id}`}
              role="tab"
              type="button"
              aria-selected={isActive}
              aria-controls={`about-panel-${tab.id}`}
              tabIndex={isActive ? 0 : -1}
              className={`${styles.tab} ${isActive ? styles.tabActive : ""}`}
              onClick={() => onChange(tab.id)}
              onKeyDown={handleKeyDown}
            >
              {tab.label}
            </button>
          );
        })}
      </div>
    </nav>
  );
}

export default AboutTabs;
