// frontend/src/lib/sanitize.js
import DOMPurify from "dompurify";

// Tags TinyMCE can actually produce. Anything else is dropped.
const ALLOWED_TAGS = [
  "p", "br", "span", "div",
  "b", "strong", "i", "em", "u", "s", "strike", "sub", "sup", "mark",
  "h1", "h2", "h3", "h4", "h5", "h6",
  "ul", "ol", "li", "blockquote", "pre", "code", "hr",
  "a", "img",
  "table", "thead", "tbody", "tfoot", "tr", "th", "td",
  "caption", "colgroup", "col",
];

const ALLOWED_ATTR = [
  "href", "target", "rel", "src", "alt", "title",
  "width", "height", "class", "style",
  "colspan", "rowspan", "align",
];

// Only these URL schemes may appear in href/src.
const ALLOWED_URI_REGEXP =
  /^(?:https?:|mailto:|tel:|data:image\/(?:png|jpe?g|gif|webp);base64,)/i;

const FORBID_TAGS = [
  "script", "style", "iframe", "object", "embed",
  "form", "input", "button", "svg", "math",
];

// srcset bypasses the src scheme check; formaction bypasses form action;
// xlink:href is the SVG script vector. The on* handlers are belt-and-braces --
// ALLOWED_ATTR already excludes them, but an allowlist typo shouldn't be fatal.
const FORBID_ATTR = [
  "srcset", "formaction", "xlink:href", "xlink:show",
  "onerror", "onload", "onclick", "onmouseover", "onfocus", "onanimationstart",
];

const BASE_CONFIG = {
  ALLOWED_TAGS,
  ALLOWED_ATTR,
  ALLOWED_URI_REGEXP,
  FORBID_TAGS,
  FORBID_ATTR,
  KEEP_CONTENT: true,
  // Block <form>/<input> name="x" shadowing document properties.
  SANITIZE_DOM: true,
  // Reject `<a name="attributes">`-style prototype clobbering.
  SANITIZE_NAMED_PROPS: true,
  ALLOW_DATA_ATTR: false,
  ALLOW_ARIA_ATTR: false,

  // ALLOWED_URI_REGEXP is applied by DOMPurify to EVERY attribute value that is
  // not on its URI-safe list - not just href/src. Without this, `colspan="2"`,
  // `width="400"`, `align="left"` etc. fail the scheme test and are silently
  // stripped, quietly mangling tables and images. Declaring the non-URL
  // attributes URI-safe keeps the strict scheme check where it belongs.
  ADD_URI_SAFE_ATTR: [
    "colspan", "rowspan", "width", "height", "align", "target", "rel",
  ],
};

// A `style` value is not a URL, so ALLOWED_URI_REGEXP never sees it, and
// DOMPurify's CSS handling leaves `url(javascript:...)`, `expression(...)`,
// `behavior:` and `-moz-binding` in place. TinyMCE never emits any of these,
// so dropping the whole attribute when one appears costs nothing real.
const DANGEROUS_CSS =
  /(?:url\s*\(|expression\s*\(|javascript\s*:|vbscript\s*:|behaviou?r\s*:|-moz-binding|@import)/i;


// addHook is global and additive. Vite HMR re-evaluates this module on every
// save, so without a guard the hook stacks up once per edit.
let hooksInstalled = false;

const installHooks = () => {
  if (hooksInstalled) return;
  hooksInstalled = true;

  DOMPurify.addHook("afterSanitizeAttributes", (node) => {
    if (node.tagName === "A" && node.hasAttribute("href")) {
      node.setAttribute("target", "_blank");
      node.setAttribute("rel", "noopener noreferrer");
    }
    // Strip any surviving event handler attribute, whatever its name.
    for (const attr of Array.from(node.attributes || [])) {
      if (/^on/i.test(attr.name)) node.removeAttribute(attr.name);
    }

    if (
      node.hasAttribute?.("style") &&
      DANGEROUS_CSS.test(node.getAttribute("style") || "")
    ) {
      node.removeAttribute("style");
    }
  });
};

// DOMPurify needs a DOM. In a service worker / SSR context it degrades to a
// no-op object, so guard rather than throwing at import time.
const isSupported =
  typeof window !== "undefined" && typeof DOMPurify.sanitize === "function";

if (isSupported) installHooks();

/**
 * Sanitize note HTML for rendering or for persistence.
 * Safe to call repeatedly - sanitization is idempotent.
 */
export const sanitizeHtml = (dirty) => {
  if (!dirty) return "";
  if (!isSupported) return ""; // fail closed: never emit unsanitized HTML
  return DOMPurify.sanitize(String(dirty), BASE_CONFIG);
};

/**
 * Sanitize before handing content to the TinyMCE editor.
 * Same policy today; kept separate so editor-only relaxations never leak
 * into the render path.
 */
export const sanitizeForEditor = (dirty) => sanitizeHtml(dirty);

/**
 * Strip all markup, for previews / search / excerpts.
 * Uses DOMPurify rather than a regex - `.replace(/<[^>]*>?/gm, "")` does not
 * handle `<img src=x onerror=...` reliably.
 */
export const stripHtml = (dirty) => {
  if (!dirty) return "";
  if (!isSupported) return "";
  return DOMPurify.sanitize(String(dirty), {
    ALLOWED_TAGS: [],
    ALLOWED_ATTR: [],
    KEEP_CONTENT: true,
  });
};

export const SANITIZE_CONFIG = BASE_CONFIG;
