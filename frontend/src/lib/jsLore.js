// Everything "JavaScript celebration" lives here: facts for the status-bar
// ticker, the history timeline, the name-cycle easter egg and the answers
// for the little console. Nothing here is ever eval()'d — the console only
// looks commands up in a table, so it can't run user input.

// Clicking the JS badge in the title bar walks through the language's names.
export const LANGUAGE_NAMES = [
  { name: "JavaScript", year: "1995–today", note: "The name that stuck." },
  { name: "Mocha", year: "May 1995", note: "Brendan Eich's 10-day prototype at Netscape." },
  { name: "LiveScript", year: "Sept 1995", note: "Shipped in Netscape Navigator 2.0 betas." },
  { name: "JavaScript", year: "Dec 1995", note: "Renamed in a marketing deal with Sun (Java)." },
  { name: "JScript", year: "1996", note: "Microsoft's reverse-engineered version in IE3." },
  { name: "ECMAScript", year: "1997", note: "Standardised by Ecma as ECMA-262." },
];

// Rotating status-bar ticker.
export const TICKER_FACTS = [
  { tag: "ES6", text: "let & const — block scope, finally" },
  { tag: "ES6", text: "Arrow functions () => keep lexical this" },
  { tag: "ES6", text: "Template literals: `Hello ${name}`" },
  { tag: "ES6", text: "Destructuring: const { a, b } = obj" },
  { tag: "ES6", text: "Promises, classes, modules, Map & Set" },
  { tag: "1995", text: "JavaScript was prototyped in 10 days" },
  { tag: "ES5", text: "\"use strict\" arrived in 2009" },
  { tag: "ES2017", text: "async / await made promises readable" },
  { tag: "ES2020", text: "Optional chaining ?. and nullish ??" },
  { tag: "ES2022", text: "Top-level await & Array.prototype.at()" },
  { tag: "ES2023", text: "toSorted() — sort without mutating" },
  { tag: "ES2024", text: "Object.groupBy() — no more reduce gymnastics" },
  { tag: "ES2025", text: "Iterator helpers & new Set methods" },
  { tag: "WAT", text: "typeof null === 'object' (since day one)" },
  { tag: "WAT", text: "0.1 + 0.2 !== 0.3 — IEEE 754 says hi" },
  { tag: "WAT", text: "[1,2,3] + [4,5,6] === '1,2,34,5,6'" },
];

// /history timeline.
export const TIMELINE = [
  { year: "1995", title: "Mocha, in 10 days", body: "Brendan Eich writes the first prototype at Netscape in May. It ships as LiveScript, then is renamed JavaScript in December.", code: "// it began here" },
  { year: "1996", title: "JScript", body: "Microsoft ships its own implementation in Internet Explorer 3. The browser wars begin.", code: "document.all ? ie() : netscape()" },
  { year: "1997", title: "ECMAScript 1", body: "Netscape hands the language to Ecma International. It is standardised as ECMA-262.", code: "ECMA-262, 1st edition" },
  { year: "1999", title: "ES3", body: "Regular expressions, try/catch and better string handling. The baseline of the web for a decade.", code: "try { } catch (e) { }" },
  { year: "2005", title: "Ajax", body: "The term is coined for apps that talk to servers without reloading. Gmail and Maps show what JS can do.", code: "new XMLHttpRequest()" },
  { year: "2006", title: "jQuery", body: "John Resig releases jQuery. For years, $ is how most people write JavaScript.", code: "$('.note').fadeIn()" },
  { year: "2008", title: "V8 & the ES4 split", body: "Chrome launches with the V8 engine and JIT compilation. The ambitious ES4 proposal is abandoned.", code: "// fast. really fast." },
  { year: "2009", title: "ES5 & Node.js", body: "Strict mode, JSON and Array extras land in ES5. Ryan Dahl brings JavaScript to the server.", code: "\"use strict\";" },
  { year: "2010", title: "npm", body: "The package manager arrives and becomes the largest software registry on earth.", code: "npm install everything" },
  { year: "2013", title: "React", body: "Facebook open-sources React. Components and a virtual DOM reshape front-end work.", code: "<Note title=\"hi\" />" },
  { year: "2015", title: "ES6 / ES2015", body: "The biggest update ever: let/const, arrow functions, classes, modules, promises, template literals, destructuring.", code: "const f = (x) => `${x}!`;" },
  { year: "2017", title: "async / await", body: "Asynchronous code finally reads top-to-bottom.", code: "const res = await fetch(url);" },
  { year: "2020", title: "?. and ??", body: "Optional chaining and nullish coalescing end a generation of && chains. BigInt arrives too.", code: "user?.profile?.name ?? 'anon'" },
  { year: "2022", title: "Top-level await", body: "Modules can await at the top level. Class fields, private #methods and .at() ship.", code: "class Vault { #pin; }" },
  { year: "2025", title: "30 years old", body: "JavaScript turns 30. ES2025 brings iterator helpers and new Set methods like union and intersection.", code: "a.union(b)" },
];

// Console commands. Keys are matched after trimming + lowercasing.
export const CONSOLE_HELP = [
  ["help", "list commands"],
  ["gotchas", "classic JavaScript surprises"],
  ["typeof null", "a 30-year-old bug"],
  ["0.1 + 0.2", "floating point fun"],
  ["[] + {}", "coercion roulette"],
  ["nan === nan", "is it though?"],
  ["history", "open the timeline"],
  ["new", "create a note"],
  ["theme", "toggle dark / vibrant"],
  ["whoami", "who's logged in"],
  ["clear", "clear the console"],
];

export const CONSOLE_ANSWERS = {
  "typeof null": [{ t: "str", v: "'object'" }, { t: "com", v: "// a bug from 1995 that can never be fixed without breaking the web" }],
  "0.1 + 0.2": [{ t: "num", v: "0.30000000000000004" }, { t: "com", v: "// IEEE 754 double precision. Use Number.EPSILON or integers (cents)." }],
  "0.1+0.2": [{ t: "num", v: "0.30000000000000004" }],
  "[] + {}": [{ t: "str", v: "'[object Object]'" }, { t: "com", v: "// [] becomes '' and {} becomes '[object Object]'" }],
  "[]+{}": [{ t: "str", v: "'[object Object]'" }],
  "[] + []": [{ t: "str", v: "''" }],
  "nan === nan": [{ t: "kw", v: "false" }, { t: "com", v: "// use Number.isNaN(x) or Object.is(NaN, NaN)" }],
  "[1,2,3] + [4,5,6]": [{ t: "str", v: "'1,2,34,5,6'" }],
  "'b' + 'a' + +'a' + 'a'": [{ t: "str", v: "'baNaNa'" }],
  "true + true": [{ t: "num", v: "2" }],
  "[10, 1, 3].sort()": [{ t: "punc", v: "[1, 10, 3]" }, { t: "com", v: "// default sort compares strings. Pass (a, b) => a - b" }],
  "0 == '0'": [{ t: "kw", v: "true" }],
  "0 == []": [{ t: "kw", v: "true" }],
  "'0' == []": [{ t: "kw", v: "false" }, { t: "com", v: "// == is not transitive. Prefer ===" }],
  "math.max()": [{ t: "num", v: "-Infinity" }],
  "math.min()": [{ t: "num", v: "Infinity" }],
  "this": [{ t: "punc", v: "Window {…}" }, { t: "com", v: "// depends entirely on how you were called. Good luck." }],
  "undefined": [{ t: "kw", v: "undefined" }],
  "null": [{ t: "kw", v: "null" }],
  "brendan": [{ t: "com", v: "// Brendan Eich wrote the first JavaScript prototype in 10 days, May 1995." }],
  "sudo": [{ t: "err", v: "ReferenceError: sudo is not defined" }, { t: "com", v: "// nice try" }],
  "rm -rf /": [{ t: "err", v: "SyntaxError: Unexpected token '/'" }, { t: "com", v: "// your notes are safe, and encrypted" }],
};

export const GOTCHAS = [
  "typeof null",
  "0.1 + 0.2",
  "[] + {}",
  "nan === nan",
  "[1,2,3] + [4,5,6]",
  "'b' + 'a' + +'a' + 'a'",
  "[10, 1, 3].sort()",
  "'0' == []",
  "math.max()",
];

export const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];

// Friendly "error-style" copy for empty and failure states.
export const LOADING_LINES = [
  "Hoisting variables…",
  "Resolving promises…",
  "Awaiting the event loop…",
  "Decrypting with AES-GCM…",
  "Bundling semicolons…",
];
