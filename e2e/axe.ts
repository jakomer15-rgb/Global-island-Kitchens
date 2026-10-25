import AxeBuilder from "@axe-core/playwright";
import type { Page } from "@playwright/test";

/**
 * Serious and critical WCAG 2.1 AA violations on the current page.
 *
 * Off-screen sections use `content-visibility: auto` (globals.css), so the browser hasn't rendered
 * them and axe can't measure their colours. They are forced visible first; colours and contrast are
 * the same either way.
 */
export async function seriousViolations(page: Page) {
  await page.addStyleTag({ content: "main > section ~ section { content-visibility: visible !important; }" });
  const results = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21aa"]).analyze();
  return results.violations
    .filter((v) => v.impact === "serious" || v.impact === "critical")
    .map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(" ")).join(", ")}`);
}
