package com.acc.sandbox;

import com.acc.sandbox.config.SandboxAutoConfiguration;
import com.acc.sandbox.registry.BackendSandboxRegistry;
import com.acc.sandbox.simulators.PayOsSimulator;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.boot.autoconfigure.AutoConfigurations;
import org.springframework.boot.test.context.runner.ApplicationContextRunner;

import static org.assertj.core.api.Assertions.assertThat;

class SandboxDecouplingIntegrationTest {

    private final ApplicationContextRunner contextRunner = new ApplicationContextRunner()
            .withConfiguration(AutoConfigurations.of(SandboxAutoConfiguration.class));

    @Test
    @DisplayName("When application.sandbox.enabled=false, zero sandbox beans should be registered (Decoupled)")
    void shouldNotRegisterBeansWhenDisabled() {
        contextRunner
                .withPropertyValues("application.sandbox.enabled=false")
                .run(context -> {
                    assertThat(context).doesNotHaveBean(BackendSandboxRegistry.class);
                    assertThat(context).doesNotHaveBean(PayOsSimulator.class);
                    assertThat(context).doesNotHaveBean(com.acc.sandbox.auth.SandboxPersonaRegistry.class);
                    assertThat(context).doesNotHaveBean(com.acc.sandbox.auth.SandboxTokenAspect.class);
                    assertThat(context).doesNotHaveBean(com.acc.sandbox.seed.SandboxDataPreWarmer.class);
                });
    }

    @Test
    @DisplayName("When application.sandbox.enabled is omitted, zero sandbox beans should be registered (Default Prod)")
    void shouldNotRegisterBeansWhenOmitted() {
        contextRunner
                .run(context -> {
                    assertThat(context).doesNotHaveBean(BackendSandboxRegistry.class);
                    assertThat(context).doesNotHaveBean(PayOsSimulator.class);
                    assertThat(context).doesNotHaveBean(com.acc.sandbox.auth.SandboxPersonaRegistry.class);
                    assertThat(context).doesNotHaveBean(com.acc.sandbox.auth.SandboxTokenAspect.class);
                    assertThat(context).doesNotHaveBean(com.acc.sandbox.seed.SandboxDataPreWarmer.class);
                });
    }

    @Test
    @DisplayName("When application.sandbox.enabled=true, sandbox registry and simulators should be registered")
    void shouldRegisterBeansWhenEnabled() {
        contextRunner
                .withPropertyValues("application.sandbox.enabled=true", "application.sandbox.mode=TEST")
                .run(context -> {
                    assertThat(context).hasSingleBean(BackendSandboxRegistry.class);
                    assertThat(context).hasSingleBean(PayOsSimulator.class);
                    assertThat(context).hasSingleBean(com.acc.sandbox.auth.SandboxPersonaRegistry.class);
                    assertThat(context).hasSingleBean(com.acc.sandbox.auth.SandboxTokenAspect.class);
                    assertThat(context).hasSingleBean(com.acc.sandbox.seed.SandboxDataPreWarmer.class);
                });
    }
}
