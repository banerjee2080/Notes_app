// The Common theme's status-bar tips: useful things, said plainly.
import type { TickerFact } from "./jsLore";
import {
  NEW_NOTE_SHORTCUT_LABEL,
  MATH_INLINE_SHORTCUT_LABEL,
  MATH_BLOCK_SHORTCUT_LABEL,
} from "../hooks/useKeyShortcut";

export const COMMON_TIPS: TickerFact[] = [
  { tag: "Tip", text: `${NEW_NOTE_SHORTCUT_LABEL} starts a new note from anywhere` },
  { tag: "Math", text: `${MATH_INLINE_SHORTCUT_LABEL} adds an equation in the line you're writing` },
  { tag: "Math", text: `${MATH_BLOCK_SHORTCUT_LABEL} adds an equation on its own line` },
  { tag: "Math", text: "Type $x^2$ with dollar signs and it turns into an equation" },
  { tag: "Offline", text: "Notes save on this device first and sync when you're back online" },
  { tag: "Bin", text: "Deleted notes wait in the bin for 30 days before they go for good" },
  { tag: "Share", text: "Share a note and edit it together, with everyone's cursor visible" },
  { tag: "Look", text: "Try the other themes in Settings: JavaScript and Pythagoras" },
];

export const COMMON_LOADING: string[] = [
  "Opening your notebook…",
  "Gathering your notes…",
  "Turning the page…",
];
