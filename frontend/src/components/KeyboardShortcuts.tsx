import { useLocation } from "react-router";
import {
  isNewNoteShortcut,
  useKeyShortcut,
  useOpenNewNote,
} from "../hooks/useKeyShortcut";

// Pages where "new note" makes no sense: the vault is locked or it's already open.
const BLOCKED = ["/pin", "/createNote", "/login", "/signup"];

/** App-wide shortcuts for signed-in users. Renders nothing. */
const KeyboardShortcuts = () => {
  const { pathname } = useLocation();
  const openNewNote = useOpenNewNote();
  useKeyShortcut(isNewNoteShortcut, openNewNote, !BLOCKED.includes(pathname));
  return null;
};

export default KeyboardShortcuts;
