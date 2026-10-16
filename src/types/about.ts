export type AboutTab =
  | "about"
  | "kasia"
  | "philosophy"
  | "content"
  | "credentials"
  | "trade";

/** One entry of the About page tab bar. */
export interface AboutTabData {
  id: AboutTab;
  label: string;
}

export interface TimelineEntry {
  year: string;
  title: string;
  detail?: string;
}

export interface CardItem {
  title: string;
  description: string;
}

export interface AboutHeroData {
  title: string;
  subtitle: string;
  quote: string;
  primaryCta: { label: string; to: string };
  secondaryCta: { label: string; to: string };
}

export interface AboutSectionData {
  welcome: string;
  mission: string;
  missionDetail: string[];
  audience: string[];
  values: CardItem[];
}

export interface MeetKasiaData {
  intro: string;
  roles: string[];
  biography: string[];
  timeline: TimelineEntry[];
  highlights: string[];
}

export interface PhilosophyData {
  intro: string;
  blocks: CardItem[];
}

export interface ContentData {
  intro: string;
  cards: CardItem[];
}

export interface CredentialsData {
  education: string[];
  professional: string[];
  currentFocus: string[];
}

export interface TradeData {
  intro: string;
  accepts: string[];
  doesNotGuarantee: string[];
  process: string[];
  editorialPolicy: string[];
  contactEmail: string;
}
