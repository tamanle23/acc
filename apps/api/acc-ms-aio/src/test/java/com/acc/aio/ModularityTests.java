package com.acc.aio;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.modulith.core.ApplicationModules;
import org.springframework.modulith.docs.Documenter;

class ModularityTests {

  @Test
  @DisplayName("Verify Spring Modulith application modules and package encapsulation")
  void createsApplicationModules() {
    ApplicationModules modules = ApplicationModules.of(AppConfig.class);
    System.out.println("=== Spring Modulith Application Modules ===");
    modules.forEach(System.out::println);
    modules.verify();
  }

  @Test
  @DisplayName("Generate Spring Modulith documentation and architecture diagrams")
  void generateDocumentation() {
    ApplicationModules modules = ApplicationModules.of(AppConfig.class);
    new Documenter(modules).writeDocumentation();
  }
}
