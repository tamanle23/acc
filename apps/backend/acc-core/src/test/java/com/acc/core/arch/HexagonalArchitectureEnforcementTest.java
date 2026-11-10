package com.acc.core.arch;

import com.tngtech.archunit.core.domain.JavaClasses;
import com.tngtech.archunit.core.importer.ClassFileImporter;
import com.tngtech.archunit.core.importer.ImportOption;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import static com.tngtech.archunit.lang.syntax.ArchRuleDefinition.noClasses;

class HexagonalArchitectureEnforcementTest {

    @Test
    @DisplayName("Domain packages must not depend on Spring, Jakarta Persistence, Hibernate, Jackson, or MyBatis")
    void domainPackagesMustBeFrameworkFree() {
        JavaClasses importedClasses = new ClassFileImporter()
                .withImportOption(ImportOption.Predefined.DO_NOT_INCLUDE_TESTS)
                .importPackages("com.acc");

        noClasses()
                .that().resideInAPackage("..domain..")
                .should().dependOnClassesThat().resideInAnyPackage(
                        "org.springframework..",
                        "jakarta.persistence..",
                        "org.hibernate..",
                        "com.fasterxml.jackson..",
                        "org.apache.ibatis.."
                )
                .because("Pure domain models and aggregates must remain 100% framework and persistence agnostic.")
                .check(importedClasses);
    }

    @Test
    @DisplayName("Pure core domain kernel must not depend on any Spring Framework classes")
    void coreDomainMustNotDependOnSpring() {
        JavaClasses importedClasses = new ClassFileImporter()
                .withImportOption(ImportOption.Predefined.DO_NOT_INCLUDE_TESTS)
                .importPackages("com.acc.core");

        noClasses()
                .that().resideInAPackage("com.acc.core.domain..")
                .should().dependOnClassesThat().resideInAnyPackage("org.springframework..")
                .because("acc-core domain kernel must never depend on Spring Framework.")
                .check(importedClasses);
    }
}
