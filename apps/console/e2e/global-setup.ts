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
    console.log('\n[E2E Dual-Mode] Mode 2 (Live Backend) detected. Checking backend health at http://localhost:8000...');
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 3500);

    try {
      // Try reaching Spring Boot backend (either /actuator/health or /api)
      const res = await fetch('http://localhost:8000/actuator/health', {
        signal: controller.signal,
      }).catch(() => fetch('http://localhost:8000/api', { signal: controller.signal }));

      clearTimeout(timeoutId);

      if (!res.ok && res.status >= 500) {
        throw new Error(`HTTP ${res.status} returned from backend.`);
      }

      console.log('✅ [E2E Dual-Mode] Live backend is healthy and responding.\n');
    } catch (err) {
      clearTimeout(timeoutId);
      console.error('\n❌ [E2E Mode 2: Live Backend Fail-Fast]');
      console.error('Could not connect to Spring Boot backend at http://localhost:8000.');
      console.error('Please ensure backend and PostgreSQL services are pre-warmed before running Mode 2:');
      console.error('  1. docker compose up -d postgres');
      console.error('  2. ./mvnw spring-boot:run -f apps/backend/pom.xml');
      console.error('Or run Mode 1 (Sandbox Autonomous) instead: pnpm test:e2e\n');
      throw new Error(`[E2E Mode 2] Live backend health check failed: ${(err as Error).message}`);
    }
  } else {
    console.log('\n✅ [E2E Dual-Mode] Mode 1 (Unified Sandbox Autonomous) active. Running offline against deterministic mock engines.\n');
  }
}
