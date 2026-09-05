// frontend/src/lib/sanitize.js
import DOMPurify from "dompurify";

// Tags TinyMCE can actually produce. Anything else is dropped.
const ALLOWED_TAGS = [
  "p",
  "br",
  "span",
  "div",
  "b",
  "strong",
  "i",
  "em",
  "u",
  "s",
  "strike",
  "sub",
  "sup",
  "mark",
  "h1",
  "h2",
  "h3",
  "h4",
  "h5",
  "h6",
  "ul",
  "ol",
  "li",
  "blockquote",
  "pre",
  "code",
  "hr",
  "a",
  "img",
  "table",
  "thead",
  "tbody",
  "tfoot",
  "tr",
  "th",
  "td",
  "caption",
  "colgroup",
  "col",
];

const ALLOWED_ATTR = [
  "href",
  "target",
  "rel",
  "src",
  "alt",
  "title",
  "width",
  "height",
  "class",
  "style",
  "colspan",
  "rowspan",
  "align",
];

// Only these URL schemes may appear in href/src.
const ALLOWED_URI_REGEXP =
  /^(?:https?:|mailto:|tel:|data:image\/(?:png|jpe?g|gif|webp);base64,)/i;

DOMPurify.addHook("afterSanitizeAttributes", (node) => {
  if (node.tagName === "A" && node.hasAttribute("href")) {
    node.setAttribute("target", "_blank");
    node.setAttribute("rel", "noopener noreferrer");
  }
});

export const sanitizeHtml = (dirty) =>
  DOMPurify.sanitize(dirty || "", {
    ALLOWED_TAGS,
    ALLOWED_ATTR,
    ALLOWED_URI_REGEXP,
    FORBID_TAGS: [
      "script",
      "style",
      "iframe",
      "object",
      "embed",
      "form",
      "input",
      "button",
      "svg",
      "math",
    ],
    FORBID_ATTR: ["srcset", "formaction", "xlink:href"],
    KEEP_CONTENT: true,
  });
