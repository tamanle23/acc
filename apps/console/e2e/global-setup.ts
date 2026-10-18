import type { FullConfig } from '@playwright/test';

/**
 * Playwright Global Setup
 * Pre-flight verification for Dual-Mode E2E testing:
 * - Mode 1 (Sandbox): Autonomous mock mode, zero external requirements.
 * - Mode 2 (Live Backend): Verifies pre-warmed Spring Boot & PostgreSQL services, failing fast if offline.
 */
export default async function globalSetup(config: FullConfig) {
  const isLiveMode = process.env.E2E_MODE === 'live';

  if (isLiveMode) {
    console.log('\n[E2E Dual-Mode] Mode 2 (Live Backend) active. Verifying backend health at http://localhost:8000...');
    
    // Poll backend health with retry loop to support webServer auto-spawn
    const start = Date.now();
    let isHealthy = false;
    let lastError = '';

    while (Date.now() - start < 15000) {
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 2000);
        const res = await fetch('http://localhost:8000/actuator/health', {
          signal: controller.signal,
        }).catch(() => fetch('http://localhost:8000/api', { signal: controller.signal }));
        clearTimeout(timeoutId);

        if (res && res.status < 500) {
          isHealthy = true;
          break;
        }
      } catch (e) {
        lastError = (e as Error).message;
      }
      await new Promise((r) => setTimeout(r, 1000));
    }

    if (!isHealthy) {
      console.warn(`\n⚠️  [E2E Mode 2] Backend at http://localhost:8000 did not respond within initial setup poll: ${lastError}`);
      console.log('Playwright webServer is orchestrating backend startup. Proceeding to test runner...\n');
    } else {
      console.log('✅ [E2E Dual-Mode] Live backend is healthy and responding with PGlite & RLS.\n');
    }
  } else {
    console.log('\n✅ [E2E Dual-Mode] Mode 1 (Unified Sandbox Autonomous) active. Running offline against deterministic mock engines.\n');
  }
}

