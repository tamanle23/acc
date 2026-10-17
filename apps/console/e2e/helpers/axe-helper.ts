import { Page, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

/**
 * Enterprise Accessibility Gating Helper (WCAG 2.2 AA)
 * - Critical & Serious violations: Trigger assertion failure
 * - Moderate & Minor warnings: Logged as advisories without failing the test
 */
export async function auditAccessibility(page: Page, contextName: string): Promise<void> {
  const accessibilityScanResults = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'])
    .analyze();

  const criticalAndSerious = accessibilityScanResults.violations.filter(
    (v) => v.impact === 'critical' || v.impact === 'serious'
  );

  const moderateAndMinor = accessibilityScanResults.violations.filter(
    (v) => v.impact === 'moderate' || v.impact === 'minor'
  );

  if (moderateAndMinor.length > 0) {
    console.warn(
      `[WCAG 2.2 AA Advisory] ${contextName} has ${moderateAndMinor.length} moderate/minor accessibility warnings:`,
      moderateAndMinor.map((v) => `[${v.impact}] ${v.id}: ${v.help} (${v.nodes.length} occurrences)`).join('; ')
    );
  }

  expect(
    criticalAndSerious,
    `Critical/Serious WCAG 2.2 AA violations in ${contextName}: ${JSON.stringify(
      criticalAndSerious.map((v) => ({ id: v.id, impact: v.impact, description: v.description, help: v.help })),
      null,
      2
    )}`
  ).toEqual([]);
}
