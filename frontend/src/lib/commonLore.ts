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

/** The Common theme's history page: writing things down, briefly. */
export const COMMON_TIMELINE: { year: string; title: string; body: string; aside: string }[] = [
  {
    year: "c. 3200 BC",
    title: "Clay and reed",
    body: "Sumerian scribes press a cut reed into wet clay. Most of the earliest tablets are not poems but accounts: grain, beer, sheep.",
    aside: "The first notes were lists.",
  },
  {
    year: "c. 2560 BC",
    title: "The Diary of Merer",
    body: "A boat crew's logbook, hauling limestone for the Great Pyramid, is the oldest inscribed papyrus yet found.",
    aside: "Someone was keeping a work journal.",
  },
  {
    year: "Rome",
    title: "Wax tablets",
    body: "Wooden frames filled with wax, written with a stylus. The flat end of the stylus smoothed the wax again.",
    aside: "The original undo.",
  },
  {
    year: "1565",
    title: "The pencil",
    body: "Conrad Gessner describes graphite held in a wooden case, soon after a large deposit was found at Borrowdale in England.",
    aside: "Notes you could take anywhere.",
  },
  {
    year: "1500s–1700s",
    title: "Commonplace books",
    body: "Readers copy passages worth keeping into one book, under headings. John Locke published his indexing method for them in 1706.",
    aside: "Where this theme gets its name.",
  },
  {
    year: "20th century",
    title: "The slip box",
    body: "The sociologist Niklas Luhmann keeps around 90,000 linked index cards and credits them with much of his work.",
    aside: "Notes that talk to each other.",
  },
  {
    year: "1980",
    title: "Sticky notes",
    body: "Post-it Notes go on sale across the United States, from a glue that was meant to be strong and wasn't.",
    aside: "A failure that stuck.",
  },
  {
    year: "Today",
    title: "This notebook",
    body: "Saved on your device as you type, synced when you're online, shared with whoever you choose.",
    aside: "Same habit, new paper.",
  },
];
