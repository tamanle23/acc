package com.acc.sandbox.config;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;
import org.springframework.boot.SpringApplication;
import org.springframework.core.Ordered;
import org.springframework.mock.env.MockEnvironment;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatNoException;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

class SandboxEnvironmentPostProcessorTest {

  private final SandboxEnvironmentPostProcessor postProcessor = new SandboxEnvironmentPostProcessor();
  private final SpringApplication application = new SpringApplication();

  @Test
  @DisplayName("Order must be HIGHEST_PRECEDENCE for earliest possible interception")
  void shouldHaveHighestPrecedenceOrder() {
    assertThat(postProcessor.getOrder()).isEqualTo(Ordered.HIGHEST_PRECEDENCE);
  }

  @ParameterizedTest
  @ValueSource(strings = {"prod", "PROD", "production", "PRODUCTION", "sit", "SIT", "uat", "UAT"})
  @DisplayName("Should throw SecurityException when sandbox enabled under restricted profile")
  void shouldThrowSecurityExceptionUnderRestrictedProfiles(String profile) {
    MockEnvironment environment = new MockEnvironment();
    environment.setProperty("application.sandbox.enabled", "true");
    environment.setActiveProfiles(profile);

    assertThatThrownBy(() -> postProcessor.postProcessEnvironment(environment, application))
        .isInstanceOf(SecurityException.class)
        .hasMessageContaining("CRITICAL SECURITY VIOLATION")
        .hasMessageContaining(profile.toLowerCase());
  }

  @Test
  @DisplayName("Should detect restricted profile in spring.profiles.active property")
  void shouldThrowWhenRestrictedProfileInActiveProperty() {
    MockEnvironment environment = new MockEnvironment();
    environment.setProperty("application.sandbox.enabled", "true");
    environment.setProperty("spring.profiles.active", "common,prod,cloud");

    assertThatThrownBy(() -> postProcessor.postProcessEnvironment(environment, application))
        .isInstanceOf(SecurityException.class)
        .hasMessageContaining("CRITICAL SECURITY VIOLATION")
        .hasMessageContaining("prod");
  }

  @ParameterizedTest
  @ValueSource(strings = {"dev", "local", "test", "docker"})
  @DisplayName("Should permit sandbox enabled under safe non-production profiles and inject PGlite properties")
  void shouldAllowSandboxUnderSafeProfiles(String profile) {
    MockEnvironment environment = new MockEnvironment();
    environment.setProperty("application.sandbox.enabled", "true");
    environment.setActiveProfiles(profile);

    assertThatNoException().isThrownBy(() -> postProcessor.postProcessEnvironment(environment, application));

    assertThat(environment.getProperty("spring.datasource.url")).startsWith("jdbc:pglite:");
    assertThat(environment.getProperty("spring.datasource.driver-class-name")).isEqualTo(SandboxEnvironmentPostProcessor.PGLITE_DRIVER);
  }

  @Test
  @DisplayName("Should activate and inject PGlite datasource when 'sandbox' profile is active")
  void shouldActivateWhenSandboxProfileActive() {
    MockEnvironment environment = new MockEnvironment();
    environment.setActiveProfiles("local", "sandbox");

    postProcessor.postProcessEnvironment(environment, application);

    assertThat(environment.getProperty("application.sandbox.enabled")).isEqualTo("true");
    assertThat(environment.getProperty("spring.datasource.url")).startsWith("jdbc:pglite:file:");
    assertThat(environment.getProperty("spring.datasource.driver-class-name")).isEqualTo(SandboxEnvironmentPostProcessor.PGLITE_DRIVER);
  }

  @Test
  @DisplayName("Should configure in-memory PGlite in TEST mode")
  void shouldConfigureInMemoryInTestMode() {
    MockEnvironment environment = new MockEnvironment();
    environment.setProperty("application.sandbox.enabled", "true");
    environment.setProperty("application.sandbox.mode", "TEST");

    postProcessor.postProcessEnvironment(environment, application);

    assertThat(environment.getProperty("spring.datasource.url")).isEqualTo("jdbc:pglite:memory://");
  }

  @Test
  @DisplayName("Should permit restricted profile when sandbox is explicitly disabled")
  void shouldAllowRestrictedProfileWhenSandboxDisabled() {
    MockEnvironment environment = new MockEnvironment();
    environment.setProperty("application.sandbox.enabled", "false");
    environment.setActiveProfiles("prod");

    assertThatNoException().isThrownBy(() -> postProcessor.postProcessEnvironment(environment, application));
    assertThat(environment.getProperty("spring.datasource.url")).isNull();
  }

  @Test
  @DisplayName("Should permit restricted profile when sandbox property is omitted (defaults to disabled)")
  void shouldAllowRestrictedProfileWhenPropertyOmitted() {
    MockEnvironment environment = new MockEnvironment();
    environment.setActiveProfiles("prod");

    assertThatNoException().isThrownBy(() -> postProcessor.postProcessEnvironment(environment, application));
    assertThat(environment.getProperty("spring.datasource.url")).isNull();
  }
}
