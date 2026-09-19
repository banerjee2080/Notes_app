// backend/src/lib/sanitize.js
//
// Single source of truth for the server-side HTML policy. Keep in sync with
// frontend/src/lib/sanitize.js - two copies of an allowlist always drift.

export const SANITIZE_CONFIG = {
  ALLOWED_TAGS: [
    "p", "br", "span", "div",
    "b", "strong", "i", "em", "u", "s", "strike", "sub", "sup", "mark",
    "h1", "h2", "h3", "h4", "h5", "h6",
    "ul", "ol", "li", "blockquote", "pre", "code", "hr",
    "a", "img",
    "table", "thead", "tbody", "tfoot", "tr", "th", "td",
    "caption", "colgroup", "col",
  ],
  ALLOWED_ATTR: [
    "href", "target", "rel", "src", "alt", "title",
    "width", "height", "class", "style",
    "colspan", "rowspan", "align",
  ],
  ALLOWED_URI_REGEXP:
    /^(?:https?:|mailto:|tel:|data:image\/(?:png|jpe?g|gif|webp);base64,)/i,
  FORBID_TAGS: [
    "script", "style", "iframe", "object", "embed",
    "form", "input", "button", "svg", "math",
  ],
  FORBID_ATTR: [
    "srcset", "formaction", "xlink:href", "xlink:show",
    "onerror", "onload", "onclick", "onmouseover", "onfocus", "onanimationstart",
  ],
  KEEP_CONTENT: true,
  SANITIZE_DOM: true,
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


// isomorphic-dompurify pulls in jsdom, which is heavy and easy for a bundler
// to mis-trace. Loading it on demand keeps a failure here scoped to note
// syncing instead of stopping the whole API from booting.
let purifierPromise = null;

const getPurifier = () => {
  if (!purifierPromise) {
    purifierPromise = import("isomorphic-dompurify")
      .then((module) => module.default)
      .catch((error) => {
        purifierPromise = null;
        throw error;
      });
  }
  return purifierPromise;
};

// Hooks are global to a DOMPurify instance and additive, so install once.
let hooksInstalled = false;

const installHooks = (DOMPurify) => {
  if (hooksInstalled) return;
  hooksInstalled = true;

  DOMPurify.addHook("afterSanitizeAttributes", (node) => {
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

export const sanitizeHtml = async (content) => {
  if (!content) return "";
  const DOMPurify = await getPurifier();
  installHooks(DOMPurify);
  return DOMPurify.sanitize(String(content), SANITIZE_CONFIG);
};

/**
 * Sanitize only when the payload is plaintext.
 *
 * When iv_content is set the body is AES-GCM ciphertext - the server has no
 * key and must not touch it. That is the zero-knowledge guarantee, and it is
 * also why the CLIENT sanitizes before encrypting (see frontend crypto.js
 * encryptHtml). This function covers the unencrypted path only.
 */
export const sanitizeIfPlaintext = async (content, ivContent) => {
  if (ivContent) return content;
  return sanitizeHtml(content);
};
