// The Pythagoras theme's ticker, loader captions and triple maths.
// Same shapes as jsLore so the status bar can show either.
import type { TickerFact } from "./jsLore";

export const PYTH_FACTS: TickerFact[] = [
  { tag: "I.47", text: "Euclid's Elements, Book I, Prop. 47: the square on the hypotenuse" },
  { tag: "1800 BC", text: "Plimpton 322: a Babylonian tablet of triples, 1,200 years before Pythagoras" },
  { tag: "2:1", text: "Octave 2:1, fifth 3:2, fourth 4:3: harmony as whole-number ratios" },
  { tag: "1847", text: "Oliver Byrne printed Euclid with coloured shapes instead of letters" },
  { tag: "1876", text: "James Garfield published a trapezoid proof, five years before the presidency" },
  { tag: "367", text: "Elisha Loomis collected 367 proofs in The Pythagorean Proposition" },
  { tag: "√2", text: "The diagonal of a unit square is irrational; legend blames Hippasus" },
  { tag: "1+2+3+4", text: "The tetractys: ten points in a triangle, sworn on by Pythagoreans" },
  { tag: "m,n", text: "Every primitive triple is m²−n², 2mn, m²+n² for some m > n" },
  { tag: "3·4·5", text: "In any triple one leg is divisible by 3, one by 4, and a side by 5" },
  { tag: "n>2", text: "aⁿ + bⁿ = cⁿ has no answers for n > 2: Fermat claimed it, Wiles proved it" },
  { tag: "Δ", text: "Every distance on this screen is √(Δx² + Δy²)" },
];

export const PYTH_LOADING: string[] = [
  "Erecting a perpendicular…",
  "Constructing the square…",
  "Bisecting the line…",
  "Stretching the 3-4-5 rope…",
  "Describing a circle…",
];

export interface Triple {
  a: number;
  b: number;
  c: number;
  /** Euclid's generators. */
  m: number;
  n: number;
}

const gcd = (x: number, y: number): number => (y === 0 ? x : gcd(y, x % y));

/** Primitive triples by Euclid's formula, smallest hypotenuse first. */
export function primitiveTriples(maxC: number): Triple[] {
  const out: Triple[] = [];
  for (let m = 2; m * m < maxC * 2; m++) {
    for (let n = 1; n < m; n++) {
      if ((m - n) % 2 === 0 || gcd(m, n) !== 1) continue;
      const c = m * m + n * n;
      if (c > maxC) break;
      const x = m * m - n * n;
      const y = 2 * m * n;
      out.push({ a: Math.min(x, y), b: Math.max(x, y), c, m, n });
    }
  }
  return out.sort((p, q) => p.c - q.c || p.a - q.a);
}

/** The triple with legs a, b scaled by k, written as LaTeX. */
export const tripleLatex = ({ a, b, c }: Triple, k = 1): string =>
  `${a * k}^2+${b * k}^2=${c * k}^2`;

/** The Pythagoras theme's chronology: the theorem before and after him. */
export const PYTH_TIMELINE: { year: string; title: string; body: string; latex: string }[] = [
  {
    year: "c. 1800 BC",
    title: "Plimpton 322",
    body: "An Old Babylonian clay tablet lists sides of right triangles in base 60. Its first row is the triple 119, 120, 169.",
    latex: "119^2+120^2=169^2",
  },
  {
    year: "c. 1800 BC",
    title: "YBC 7289",
    body: "A student's tablet draws a square with its diagonals and gives the diagonal of the unit square to about six decimal places.",
    latex: "\\sqrt{2}\\approx 1;24,51,10_{60}\\approx 1.414213",
  },
  {
    year: "c. 800–500 BC",
    title: "Baudhāyana Śulba Sūtra",
    body: "Indian rules for building altars with stretched cords state that a rectangle's diagonal produces both areas its sides produce separately.",
    latex: "d^2=a^2+b^2",
  },
  {
    year: "c. 570 BC",
    title: "Pythagoras of Samos",
    body: "Born on Samos, he later founds a school at Croton. He left no writings; the theorem carries his name by tradition.",
    latex: "2:1,\\;3:2,\\;4:3",
  },
  {
    year: "c. 300 BC",
    title: "Euclid, Elements I.47",
    body: "The first proof that survives, with its 'windmill' figure. Proposition 48, right after it, proves the converse.",
    latex: "BC^2=AB^2+AC^2",
  },
  {
    year: "Han dynasty",
    title: "Zhoubi Suanjing",
    body: "The Chinese 'gougu' theorem, with the hypotenuse diagram: a square on the hypotenuse built from four triangles and a small square.",
    latex: "c^2=4\\cdot\\tfrac{ab}{2}+(b-a)^2",
  },
  {
    year: "1637",
    title: "Fermat's margin",
    body: "Fermat writes that no cube splits into two cubes, nor any higher power, and that the margin is too narrow for his proof.",
    latex: "a^n+b^n\\neq c^n\\;(n>2)",
  },
  {
    year: "1847",
    title: "Byrne's Euclid",
    body: "Oliver Byrne prints the Elements with coloured shapes in place of letters. This theme borrows his red, yellow and blue.",
    latex: "\\textcolor{#d1352b}{a^2}+\\textcolor{#f0b323}{b^2}=\\textcolor{#3d7cc9}{c^2}",
  },
  {
    year: "1876",
    title: "Garfield's trapezoid",
    body: "Congressman James Garfield publishes a proof using a trapezoid made of three right triangles, five years before his presidency.",
    latex: "\\tfrac{(a+b)^2}{2}=ab+\\tfrac{c^2}{2}",
  },
  {
    year: "1940",
    title: "367 proofs",
    body: "Elisha Loomis's The Pythagorean Proposition, second edition, collects 367 proofs, algebraic and geometric.",
    latex: "\\#\\text{proofs}\\ge 367",
  },
  {
    year: "1994",
    title: "Wiles",
    body: "Andrew Wiles, with Richard Taylor, completes the proof of Fermat's Last Theorem, published the following year.",
    latex: "a^n+b^n=c^n,\\;n>2\\;\\Rightarrow\\;abc=0",
  },
];
