/**
 * Definisi Tipe dan Interface untuk Kurasi HyperUI & Registry Bundel Tema
 */

export type HyperUIThemeId =
  | 'modern_minimalist'
  | 'corporate_formal'
  | 'sleek_dark'
  | 'warm_pastel'
  | 'playful_neobrutalism'
  | 'vibrant_saas';

export interface ThemeComponentStyle {
  bodyBg: string;
  card: string;
  table: string;
  tableHeader: string;
  tableRow: string;
  input: string;
  select: string;
  buttonPrimary: string;
  buttonSecondary: string;
  buttonDanger: string;
  badge: {
    success: string;
    warning: string;
    danger: string;
    info: string;
  };
  tabActive: string;
  tabInactive: string;
  modalContainer: string;
  banner: string;
}

export interface ThemeMarkupTemplates {
  loginCard: string;
  tabNav: string;
  statCard: string;
  table: string;
  modal: string;
  reportBanner: string;
}

export interface ThemeBundle {
  id: HyperUIThemeId;
  name: string;
  tagline: string;
  description: string;
  palette: {
    primary: string;
    secondary: string;
    accent: string;
    background: string;
    cardBg: string;
    border: string;
    text: string;
    isDark?: boolean;
  };
  traits: {
    borderRadius: string;
    shadow: string;
    borderWeight: string;
    mood: string;
  };
  semanticNuances: string[];
  templates: ThemeMarkupTemplates;
  classes: ThemeComponentStyle;
}

export interface ThemeRecommendationResult {
  recommendedThemeId: HyperUIThemeId;
  themeName: string;
  reason: string;
  confidence?: number;
}
