import { readFileSync, readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { JSDOM } from "jsdom";
import { describe, expect, it } from "vitest";

const root = dirname(fileURLToPath(import.meta.url));
const appRoot = join(root, "..");

function page(name) {
  const html = readFileSync(join(root, name, "index.html"), "utf8");
  return { html, dom: new JSDOM(html) };
}

describe("public legal pages", () => {
  it("renders Terms and Privacy without auth, scripts, or secrets", () => {
    for (const name of ["terms", "privacy"]) {
      const { html, dom } = page(name);
      const document = dom.window.document;
      expect(document.querySelector("h1").textContent.length).toBeGreaterThan(5);
      expect(document.querySelector('meta[name="viewport"]').getAttribute("content")).toContain("width=device-width");
      expect(document.querySelector('meta[name="description"]').getAttribute("content")).toBeTruthy();
      expect(document.querySelector('meta[name="robots"]').getAttribute("content")).toBe("index, follow");
      expect(document.querySelectorAll("script")).toHaveLength(0);
      expect(html).not.toMatch(/AUTH_SECRET|TIKTOK_CLIENT_SECRET|client_secret=|localStorage|gtag\(|googletagmanager/i);
      expect(html).not.toMatch(/@[a-z0-9.-]+\.[a-z]{2,}/i);
      expect(document.querySelector("[data-legal-contact]").textContent).toMatch(/not been set/i);
    }
  });

  it("links the two pages to each other", () => {
    const terms = page("terms").dom.window.document;
    const privacy = page("privacy").dom.window.document;
    expect(terms.querySelector('a[href="../privacy/"]')).toBeTruthy();
    expect(privacy.querySelector('a[href="../terms/"]')).toBeTruthy();
  });

  it("stays outside the application routes and keeps a readable mobile width", () => {
    const css = readFileSync(join(root, "assets", "legal.css"), "utf8");
    expect(css).toContain("max-width: 640px");
    expect(css).toContain("min(40rem");
    const appFiles = readdirSync(join(appRoot, "app"), { recursive: true }).map(String);
    const publicFiles = readdirSync(join(appRoot, "public"), { recursive: true }).map(String);
    expect(appFiles.some((file) => /terms|privacy/.test(file))).toBe(false);
    expect(publicFiles.some((file) => /terms|privacy/.test(file))).toBe(false);
    const terms = readFileSync(join(root, "terms", "index.html"), "utf8");
    expect(terms).not.toMatch(/\/api\/|\/accounts|\/campaigns|server\/connectors/);
  });
});
