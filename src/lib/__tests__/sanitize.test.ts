import { describe, expect, it } from "vitest";
import { sanitizeJobDescription, stripToPlainText, decodeHtmlEntities } from "@/lib/sanitize";

describe("sanitizeJobDescription", () => {
  it("strips script tags and their contents", () => {
    const out = sanitizeJobDescription("<p>Hello</p><script>alert('xss')</script>");
    expect(out).not.toContain("<script>");
    expect(out).not.toContain("alert");
    expect(out).toContain("<p>Hello</p>");
  });

  it("strips event handler attributes", () => {
    const out = sanitizeJobDescription('<p onclick="alert(1)">Hi</p>');
    expect(out).not.toContain("onclick");
    expect(out).not.toContain("alert(1)");
  });

  it("keeps allowed formatting tags", () => {
    const out = sanitizeJobDescription("<ul><li><strong>Bold</strong> item</li></ul>");
    expect(out).toBe("<ul><li><strong>Bold</strong> item</li></ul>");
  });

  it("drops disallowed tags but keeps their text content", () => {
    const out = sanitizeJobDescription("<div>Wrapped</div>");
    expect(out).not.toContain("<div>");
    expect(out).toContain("Wrapped");
  });

  it("rewrites links to open safely in a new tab", () => {
    const out = sanitizeJobDescription('<a href="https://example.com">link</a>');
    expect(out).toContain('href="https://example.com"');
    expect(out).toContain('target="_blank"');
    expect(out).toContain('rel="noopener noreferrer"');
  });

  it("blocks javascript: scheme links", () => {
    const out = sanitizeJobDescription('<a href="javascript:alert(1)">click</a>');
    expect(out).not.toContain("javascript:");
  });

  it("strips style attributes and other non-whitelisted attributes", () => {
    const out = sanitizeJobDescription('<p style="color:red" class="foo" data-x="1">Text</p>');
    expect(out).toBe("<p>Text</p>");
  });
});

describe("stripToPlainText", () => {
  it("removes all tags", () => {
    expect(stripToPlainText("<p><strong>Bold</strong> text</p>")).toBe("Bold text");
  });

  it("removes scripts entirely (tag and content)", () => {
    expect(stripToPlainText("<script>alert(1)</script>Safe")).toBe("Safe");
  });

  it("collapses whitespace and trims", () => {
    expect(stripToPlainText("  Hello   \n\n  World  ")).toBe("Hello World");
  });
});

describe("decodeHtmlEntities", () => {
  it("decodes common named entities", () => {
    expect(decodeHtmlEntities("&lt;div&gt;")).toBe("<div>");
    expect(decodeHtmlEntities("Tom &amp; Jerry")).toBe("Tom & Jerry");
    expect(decodeHtmlEntities("&quot;quoted&quot;")).toBe('"quoted"');
    expect(decodeHtmlEntities("a&nbsp;b")).toBe("a b");
  });

  it("is a no-op on plain text with no entities", () => {
    expect(decodeHtmlEntities("Just plain text, no markup here.")).toBe(
      "Just plain text, no markup here."
    );
  });
});

describe("Arbeitnow double-escaped description regression", () => {
  it("decodes entity-escaped HTML into real tags before sanitizing", () => {
    const raw = "&lt;div&gt;&lt;p&gt;Hello&lt;/p&gt;&lt;/div&gt;";
    const out = sanitizeJobDescription(decodeHtmlEntities(raw));
    expect(out).toBe("<p>Hello</p>");
    expect(out).not.toContain("&lt;");
    expect(out).not.toContain("&gt;");
  });

  it("leaves already-plain descriptions readable", () => {
    const raw = "This role requires 5 years of experience.";
    const out = sanitizeJobDescription(decodeHtmlEntities(raw));
    expect(out).toBe("This role requires 5 years of experience.");
  });
});
