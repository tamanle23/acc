# Project Documentation & Architectural History

This directory permanently archives the planning and verification history for the project. Documents here are versioned by phase/topic and are never overwritten.

---

## 1. Migration to Java 17 LTS, Spring Boot 4.1 & Spring Modulith 2
- **Plan**: [01_spring_modulith_2_migration_plan.md](file:///c:/Users/Admin/workspace/git/prjz/doc/history/01_spring_modulith_2_migration_plan.md)
  - Details the upgrade from Java 8 / Spring Boot 2.3 / Spring Cloud Hoxton to Java 17 LTS, Spring Boot 4.1.1, Spring Framework 7.0.9, Jakarta EE 11, and Spring Modulith 2.1.1.
- **Walkthrough**: [01_spring_modulith_2_migration_walkthrough.md](file:///c:/Users/Admin/workspace/git/prjz/doc/history/01_spring_modulith_2_migration_walkthrough.md)
  - Verification results and module-by-module migration summary.

---

## 2. Global Project Rename to `acc`
- **Plan**: [02_rename_to_acc_plan.md](file:///c:/Users/Admin/workspace/git/prjz/doc/history/02_rename_to_acc_plan.md)
  - Complete refactoring plan for renaming `prjz` to `acc` across directories, packages, POMs, and configurations.
- **Walkthrough**: [02_rename_to_acc_walkthrough.md](file:///c:/Users/Admin/workspace/git/prjz/doc/history/02_rename_to_acc_walkthrough.md)
  - Execution summary and full build and architecture verification outputs.

---

## 3. Removal of Legacy Orika Mapping Library
- **Plan**: [03_remove_orika_plan.md](file:///c:/Users/Admin/workspace/git/prjz/doc/history/03_remove_orika_plan.md)
  - Plan for completely removing Orika from `acc-fw` and standardizing on MapStruct.
- **Walkthrough**: [03_remove_orika_walkthrough.md](file:///c:/Users/Admin/workspace/git/prjz/doc/history/03_remove_orika_walkthrough.md)
  - Execution summary, file deletions, and verification across all modules.

