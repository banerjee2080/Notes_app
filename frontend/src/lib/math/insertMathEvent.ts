// A window event for handing an equation to whichever note editor is open.
// The editor calls preventDefault() when it takes it, so the sender can tell
// "inserted" from "no editable note open".
import type { MathKind } from "../../components/math/mathNodes";

export const INSERT_MATH_EVENT = "notejs:insert-math";

export interface InsertMathDetail {
  latex: string;
  kind: MathKind;
}

/** True if an open, editable note took the equation. */
export function sendMathToEditor(detail: InsertMathDetail): boolean {
  const e = new CustomEvent<InsertMathDetail>(INSERT_MATH_EVENT, { detail, cancelable: true });
  return !window.dispatchEvent(e);
}
