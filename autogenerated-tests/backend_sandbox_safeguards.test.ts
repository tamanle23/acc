import { describe, test, expect } from 'bun:test';
import * as fs from 'fs';
import * as path from 'path';

/**
 * Formal Verification Matrix: Backend Sandbox Two-Tier Safeguards & In-Process PGlite WASM
 * Reference: docs/iterations/master_implementation_plan_iteration_58.md
 * Target Modules: apps/backend/acc-sandbox, apps/backend/acc-ms-aio, apps/backend/pom.xml
 */
describe('Iteration 58: Backend Sandbox Two-Tier Safeguards & PGlite WASM Parity', () => {
  const repoRoot = path.resolve(__dirname, '..');

  // TC-SB-01: Zonky Native Embedded PostgreSQL Dependency Declaration
  test('TC-SB-01: acc-sandbox/pom.xml must declare io.zonky.test:embedded-postgres non-optional', () => {
    const pomPath = path.join(repoRoot, 'apps/backend/acc-sandbox/pom.xml');
    expect(fs.existsSync(pomPath)).toBe(true);

    const content = fs.readFileSync(pomPath, 'utf-8');
    expect(content).toContain('io.zonky.test');
    expect(content).toContain('embedded-postgres');
    expect(content).toContain('embedded-postgres-binaries-bom');
    // Ensure old buggy dependencies are gone
    expect(content).not.toContain('pglite-spring-boot-test');
    expect(content).not.toContain('pglite4j-jdbc');

    // Ensure embedded-postgres is not marked optional
    const zonkyDepBlock = content.match(/<dependency>[\s\S]*?io\.zonky\.test[\s\S]*?<\/dependency>/);
    expect(zonkyDepBlock).not.toBeNull();
    expect(zonkyDepBlock![0]).not.toContain('<optional>true</optional>');
  });

  // TC-SB-02: Native Embedded PostgreSQL Configuration & Zero External Fallback
  test('TC-SB-02: EmbeddedPostgresDatasourceConfiguration must strictly enforce postgres driver with zero external postgres fallback', () => {
    const configPath = path.join(
      repoRoot,
      'apps/backend/acc-sandbox/src/main/java/com/acc/sandbox/db/EmbeddedPostgresDatasourceConfiguration.java'
    );
    expect(fs.existsSync(configPath)).toBe(true);

    const content = fs.readFileSync(configPath, 'utf-8');
    expect(content).toContain('io.zonky.test.db.postgres.embedded.EmbeddedPostgres');
    expect(content).toContain('org.postgresql.Driver');
    expect(content).toContain('embeddedPostgres');
    expect(content).toContain('sandboxDataSource');

    // Absolute prohibition of external localhost:5432/acc fallback
    expect(content).not.toContain('localhost:5432/acc');
    expect(content).not.toContain('ensurePostgresDatabaseExists');

    // SandboxProperties must not have @Component or @Primary to prevent duplicate bean clash
    const propsPath = path.join(
      repoRoot,
      'apps/backend/acc-sandbox/src/main/java/com/acc/sandbox/config/SandboxProperties.java'
    );
    const propsContent = fs.readFileSync(propsPath, 'utf-8');
    expect(propsContent).not.toContain('@Component');
    expect(propsContent).not.toContain('@Primary');
  });

  // TC-SB-03: Safeguard Level 1 — Runtime EnvironmentPostProcessor & spring.factories
  test('TC-SB-03: SandboxEnvironmentPostProcessor must have HIGHEST_PRECEDENCE and be registered in spring.factories', () => {
    const postProcessorPath = path.join(
      repoRoot,
      'apps/backend/acc-sandbox/src/main/java/com/acc/sandbox/config/SandboxEnvironmentPostProcessor.java'
    );
    const factoriesPath = path.join(
      repoRoot,
      'apps/backend/acc-sandbox/src/main/resources/META-INF/spring.factories'
    );

    expect(fs.existsSync(postProcessorPath)).toBe(true);
    expect(fs.existsSync(factoriesPath)).toBe(true);

    const javaContent = fs.readFileSync(postProcessorPath, 'utf-8');
    expect(javaContent).toContain('implements EnvironmentPostProcessor, Ordered');
    expect(javaContent).toContain('Ordered.HIGHEST_PRECEDENCE');
    expect(javaContent).toContain('throw new SecurityException');
    expect(javaContent).toContain('"prod"');
    expect(javaContent).toContain('"production"');
    expect(javaContent).toContain('"sit"');
    expect(javaContent).toContain('"uat"');
    expect(javaContent).toContain('jdbc:postgresql:');
    expect(javaContent).toContain('org.postgresql.Driver');

    const factoriesContent = fs.readFileSync(factoriesPath, 'utf-8');
    expect(factoriesContent).toContain('org.springframework.boot.env.EnvironmentPostProcessor');
    expect(factoriesContent).toContain('com.acc.sandbox.config.SandboxEnvironmentPostProcessor');
  });

  // TC-SB-04: Safeguard Level 2 — Build-Time Maven Packaging Exclusion
  test('TC-SB-04: acc-ms-aio/pom.xml must encapsulate acc-sandbox in profile conditional on !excludeSandbox', () => {
    const aioPomPath = path.join(repoRoot, 'apps/backend/acc-ms-aio/pom.xml');
    expect(fs.existsSync(aioPomPath)).toBe(true);

    const content = fs.readFileSync(aioPomPath, 'utf-8');

    // Unconditional dependencies section must NOT contain acc-sandbox
    const dependenciesSection = content.split('<profiles>')[0];
    expect(dependenciesSection).not.toContain('<artifactId>acc-sandbox</artifactId>');

    // Profiles section must contain sandbox profile
    expect(content).toContain('<id>sandbox</id>');
    expect(content).toContain('<name>!excludeSandbox</name>');
    expect(content).toContain('<artifactId>acc-sandbox</artifactId>');

    // Prod, sit, uat profiles must declare excludeSandbox property
    expect(content).toContain('<id>prod</id>');
    expect(content).toContain('<id>sit</id>');
    expect(content).toContain('<id>uat</id>');
    expect(content).toContain('<excludeSandbox>true</excludeSandbox>');
  });

  // TC-SB-05: Production Profile Configs Explicitly Disable Sandbox
  test('TC-SB-05: application-prod.yml, application-sit.yml, and application-uat.yml must set application.sandbox.enabled=false and application-sandbox.yml must configure pglite', () => {
    const envFiles = [
      'application-prod.yml',
      'application-sit.yml',
      'application-uat.yml',
    ];

    for (const file of envFiles) {
      const filePath = path.join(repoRoot, 'apps/backend/acc-ms-aio/src/main/resources', file);
      expect(fs.existsSync(filePath)).toBe(true);

      const content = fs.readFileSync(filePath, 'utf-8');
      expect(content).toMatch(/sandbox:\s*\n\s*enabled:\s*false/);
    }

    const sandboxYamlPath = path.join(repoRoot, 'apps/backend/acc-ms-aio/src/main/resources/application-sandbox.yml');
    expect(fs.existsSync(sandboxYamlPath)).toBe(true);
    const sandboxYaml = fs.readFileSync(sandboxYamlPath, 'utf-8');
    expect(sandboxYaml).toContain('jdbc:pglite:../../tmp/db/pglite-sandbox');
    expect(sandboxYaml).not.toContain('jdbc:pglite:file:');
    expect(sandboxYaml).toContain('io.roastedroot.pglite4j.jdbc.PgLiteDriver');
  });

  // TC-SB-06: Production and Non-Sandbox Build Scripts
  test('TC-SB-06: package.json and apps/backend/package.json must provide build:prod and build:no-sandbox', () => {
    const rootPkgPath = path.join(repoRoot, 'package.json');
    const backendPkgPath = path.join(repoRoot, 'apps/backend/package.json');

    const rootPkg = JSON.parse(fs.readFileSync(rootPkgPath, 'utf-8'));
    const backendPkg = JSON.parse(fs.readFileSync(backendPkgPath, 'utf-8'));

    expect(rootPkg.scripts['build:prod']).toBeDefined();
    expect(rootPkg.scripts['build:no-sandbox']).toBeDefined();

    expect(backendPkg.scripts['build:prod']).toBeDefined();
    expect(backendPkg.scripts['build:prod']).toContain('-Pprod');
    expect(backendPkg.scripts['build:prod']).toContain('-DexcludeSandbox');

    expect(backendPkg.scripts['build:no-sandbox']).toBeDefined();
    expect(backendPkg.scripts['build:no-sandbox']).toContain('-DexcludeSandbox');
  });

  // TC-SB-07: Core Logic Independence Invariant — acc-fw must NOT reference sandbox
  test('TC-SB-07: Core logic in acc-fw (AuditPartitionProvisioner) must be completely decoupled from sandbox', () => {
    const auditProvPath = path.join(
      repoRoot,
      'apps/backend/acc-fw/src/main/java/com/acc/service/AuditPartitionProvisioner.java'
    );
    expect(fs.existsSync(auditProvPath)).toBe(true);

    const content = fs.readFileSync(auditProvPath, 'utf-8');
    // Absolute prohibition of sandbox coupling in core logic
    expect(content).not.toContain('application.sandbox');
    expect(content).not.toContain('sandboxEnabled');
    expect(content).not.toContain('com.acc.sandbox');
  });

  // TC-SB-08: HikariCP Connection Pool Bounds & Driver for Embedded PostgreSQL
  test('TC-SB-08: application-sandbox.yml must configure embedded PostgreSQL with org.postgresql.Driver', () => {
    const sandboxYamlPath = path.join(
      repoRoot,
      'apps/backend/acc-ms-aio/src/main/resources/application-sandbox.yml'
    );
    expect(fs.existsSync(sandboxYamlPath)).toBe(true);

    const content = fs.readFileSync(sandboxYamlPath, 'utf-8');
    expect(content).toContain('maximum-pool-size: 10');
    expect(content).toContain('minimum-idle: 2');
    expect(content).toContain('connection-timeout: 30000');
    expect(content).toContain('org.postgresql.Driver');
    expect(content).toContain('jdbc:postgresql://localhost:54329/postgres');
    expect(content).toContain('embedded-postgres: true');
  });

  // TC-SB-09: Authoritative Liquibase Schema Migration on PGlite in Sandbox Mode
  test('TC-SB-09: acc-sandbox must include acc-db and declare SandboxLiquibaseConfiguration for schema migrations', () => {
    const sandboxPomPath = path.join(repoRoot, 'apps/backend/acc-sandbox/pom.xml');
    expect(fs.existsSync(sandboxPomPath)).toBe(true);
    const pomContent = fs.readFileSync(sandboxPomPath, 'utf-8');
    expect(pomContent).toContain('<artifactId>acc-db</artifactId>');
    expect(pomContent).toContain('<artifactId>spring-boot-starter-liquibase</artifactId>');

    const liquibaseConfigPath = path.join(
      repoRoot,
      'apps/backend/acc-sandbox/src/main/java/com/acc/sandbox/db/SandboxLiquibaseConfiguration.java'
    );
    expect(fs.existsSync(liquibaseConfigPath)).toBe(true);
    const configContent = fs.readFileSync(liquibaseConfigPath, 'utf-8');
    expect(configContent).toContain('class SandboxLiquibaseConfiguration');
    expect(configContent).toContain('SpringLiquibase');
    expect(configContent).toContain('classpath:db/sandbox/changelog-master.xml');
    expect(configContent).toContain('sandboxLiquibase');

    const sandboxChangelogPath = path.join(
      repoRoot,
      'apps/backend/acc-sandbox/src/main/resources/db/sandbox/changelog-master.xml'
    );
    expect(fs.existsSync(sandboxChangelogPath)).toBe(true);
    const changelogContent = fs.readFileSync(sandboxChangelogPath, 'utf-8');
    expect(changelogContent).toContain('changelog-identity-mock_data.xml');
    expect(changelogContent).not.toContain('<include file="db/acc/changelog-identity-mock_data.xml" context=');
  });
});
