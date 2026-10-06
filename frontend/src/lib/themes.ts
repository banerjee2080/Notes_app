// The three looks. They share one layout (title bar, sidebar, toolbar, status
// bar); what changes is colour, type, artwork and the app's "voice".
//
//  - common:     plain words, Kamisaka Sekka's Momoyogusa prints (1909)
//  - js:         the original Note.js IDE, the only theme with the console
//  - pythagoras: a geometer's drafting table, Oliver Byrne's Euclid (1847)

export type ThemeId = "common" | "js" | "pythagoras";

export interface ThemeInfo {
  id: ThemeId;
  name: string;
  blurb: string;
  /** Default wallpaper per mode; an uploaded wallpaper still wins. */
  wallpaper: { dark: string; light: string };
  /** Small picture for the theme picker. */
  swatch: string;
}

export const THEMES: ThemeInfo[] = [
  {
    id: "common",
    name: "Common",
    blurb: "Plain and calm. Sekka's woodblock prints, 1909.",
    wallpaper: { light: "/themes/sekka-pines.webp", dark: "/themes/sekka-village.webp" },
    swatch: "/themes/sekka-pines.webp",
  },
  {
    id: "js",
    name: "JavaScript",
    blurb: "The original IDE. Ten days in May 1995, and a console.",
    wallpaper: { light: "/bg.png", dark: "/bg.png" },
    swatch: "/bg.png",
  },
  {
    id: "pythagoras",
    name: "Pythagoras",
    blurb: "A drafting table. Byrne's coloured Euclid, 1847.",
    // Drawn in CSS (grid + Byrne's Prop. 47 diagram), see index.css.
    wallpaper: { light: "", dark: "" },
    swatch: "/themes/byrne-prop47.svg",
  },
];

export const DEFAULT_THEME: ThemeId = "common";

export const isThemeId = (v: unknown): v is ThemeId =>
  v === "common" || v === "js" || v === "pythagoras";

export const themeInfo = (id: ThemeId): ThemeInfo =>
  THEMES.find((t) => t.id === id) ?? THEMES[0];
