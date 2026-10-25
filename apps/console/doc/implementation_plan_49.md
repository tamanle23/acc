# Architecture Blueprint: Frontend Architecture Standards

## 1. Design Strategy
**Goal:** Guarantee strict architectural separation of concerns on the client side while establishing the mandatory 'Liquid Glass' UI visual identity.

**Chosen Patterns & Rationale:**
- **Facade Pattern:** Extracted network API calls and state management interactions (e.g., TanStack Query) into isolated, domain-specific hooks (`useRegisterUserFacade`). This ensures React view components remain pure and unaware of underlying transport mechanisms or caching strategies.
- **Mediator Pattern:** By using TanStack's `useQueryClient` to invalidate queries automatically on mutation success, we avoid having the UI directly coordinate state updates across disparate components.
- **Atomic Design (Liquid Glass):** Implemented foundational Liquid Glass components (`GlassCard`) in the shared `@acc/ui` workspace. Centralizing these tokens ensures multi-platform consistency and DRY compliance.

## 2. Architecture Structure
- `packages/ui/src/components/glass/glass-card.tsx`: Shared UI library containing strict atomic elements adhering to the Liquid Glass design standards (multi-layer blurs, frosted scrims, specular borders).
- `apps/console/src/features/users/api/useRegisterUserFacade.ts`: Domain-scoped facade hooking into the backend CQRS API via REST.
- `apps/console/src/features/users/components/RegisterUserForm.tsx`: React UI component executing the facade hook, integrating the `GlassCard` and displaying the decoupled logic.

## 3. Extensibility (OCP)
The Facade approach strictly enforces the Open/Closed Principle. If the underlying data transport changes (e.g., moving from REST to GraphQL or WebSockets), only the Facade hook changes. The hundreds of view components consuming the hook require zero modification.
