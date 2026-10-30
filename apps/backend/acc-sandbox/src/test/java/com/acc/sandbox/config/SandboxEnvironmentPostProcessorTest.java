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
  @DisplayName("Should permit sandbox enabled under safe non-production profiles")
  void shouldAllowSandboxUnderSafeProfiles(String profile) {
    MockEnvironment environment = new MockEnvironment();
    environment.setProperty("application.sandbox.enabled", "true");
    environment.setActiveProfiles(profile);

    assertThatNoException().isThrownBy(() -> postProcessor.postProcessEnvironment(environment, application));
  }

  @Test
  @DisplayName("Should permit restricted profile when sandbox is explicitly disabled")
  void shouldAllowRestrictedProfileWhenSandboxDisabled() {
    MockEnvironment environment = new MockEnvironment();
    environment.setProperty("application.sandbox.enabled", "false");
    environment.setActiveProfiles("prod");

    assertThatNoException().isThrownBy(() -> postProcessor.postProcessEnvironment(environment, application));
  }

  @Test
  @DisplayName("Should permit restricted profile when sandbox property is omitted (defaults to disabled)")
  void shouldAllowRestrictedProfileWhenPropertyOmitted() {
    MockEnvironment environment = new MockEnvironment();
    environment.setActiveProfiles("prod");

    assertThatNoException().isThrownBy(() -> postProcessor.postProcessEnvironment(environment, application));
  }
}
