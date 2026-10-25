# Storage Provider Configuration and Assignments Implementation

## Changes Made
- **Data Model**: Updated `StorageProvider` in `storages.tsx` so that `assignedWorkspaces` uses a detailed object structure: `Array<{ workspaceId: string, enabled: boolean }>` instead of a simple array of strings.
- **UI Components**:
  - **StorageAssignmentsDialog**: Created a new dialog component that lists workspaces, allowing assignment of unassigned workspaces, and toggling enablement of already assigned workspaces.
  - **StorageManageDialog**: Created a new dialog component to handle general configuration for the storage provider (mocked with Bucket and API Key inputs).
  - **index.tsx**: Refactored the User Provided storage cards to display two distinct buttons: "Manage" and "Assignments". These buttons trigger their respective dialogs.
- **Localization**: Added translation strings for the new dialog titles, actions, toast messages, and button labels to both `en` and `vi` JSON files.

## Verification
- Code successfully passes the `@acc/console` ESLint and type checks (warnings unrelated to these components).
- Dialog structures, glass effects, blurs, and border opacities adhere closely to the project's Liquid Glass UI requirements.
- The separation of Manage and Assignments workflows ensures clarity and safety, especially with the immutability of an assignment (once assigned, the workspace can only be toggled enabled/disabled).
