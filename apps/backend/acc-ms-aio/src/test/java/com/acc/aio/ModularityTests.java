package com.acc.aio;

import org.junit.jupiter.api.Test;
import org.springframework.modulith.core.ApplicationModules;

class ModularityTests {

  @Test
  void createsApplicationModules() {
    ApplicationModules modules = ApplicationModules.of(AppConfig.class);
    System.out.println("=== Spring Modulith Application Modules ===");
    modules.forEach(System.out::println);
    modules.verify();
  }
}
