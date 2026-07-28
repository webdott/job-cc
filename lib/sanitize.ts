import sanitizeHtml from "sanitize-html";

/**
 * Sanitize a job description that may contain HTML.
 * Allows safe formatting tags only. Strips all scripts, styles,
 * event handlers, and dangerous attributes.
 */
export function sanitizeJobDescription(input: string): string {
  return sanitizeHtml(input, {
    allowedTags: [
      "p",
      "br",
      "ul",
      "ol",
      "li",
      "strong",
      "b",
      "em",
      "i",
      "h1",
      "h2",
      "h3",
      "h4",
      "a",
    ],
    allowedAttributes: {
      // href is user-controlled (rewritten below); target/rel are the fixed
      // safe-new-tab values transformTags injects — both must be allowlisted
      // or sanitize-html strips them right back out after the transform.
      a: ["href", "target", "rel"],
    },
    allowedSchemes: ["https", "http", "mailto"],
    // Strip all other attributes (style, class, id, data-*, on*)
    allowedSchemesByTag: {},
    transformTags: {
      // Open all links in a new tab safely
      a: (_tagName, attribs) => ({
        tagName: "a",
        attribs: {
          href: attribs.href ?? "#",
          target: "_blank",
          rel: "noopener noreferrer",
        },
      }),
    },
  });
}

/**
 * Strip all HTML and return plain text — used for sources that
 * already gave us plain text but may have stray tags.
 */
export function stripToPlainText(input: string): string {
  return sanitizeHtml(input, { allowedTags: [], allowedAttributes: {} })
    .replace(/\s+/g, " ")
    .trim();
}
