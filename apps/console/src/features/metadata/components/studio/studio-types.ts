/**
 * Types and interfaces for the Visual Dynamic Schema & State Machine (FSM) Workflow Studio.
 */

import type { UiComponentType, DataType } from '../../api/types';

export interface PaletteFieldItem {
  id: string;
  uiComponent: UiComponentType;
  defaultDataType: DataType;
  label: string;
  description: string;
  iconName: string;
  category: 'PRIMITIVE' | 'COMPLEX' | 'EXTENDED';
}

export interface FsmStateNode extends Record<string, unknown> {
  id: string; // e.g. 'DRAFT', 'SUBMITTED', 'APPROVED', 'PUBLISHED', 'ARCHIVED'
  label: string;
  isInitial?: boolean;
  isTerminal?: boolean;
  color: string;
  description?: string;
}

export interface FsmTransitionEdge extends Record<string, unknown> {
  id: string;
  sourceState: string;
  targetState: string;
  triggerEvent: string; // e.g. 'SUBMIT', 'APPROVE', 'REJECT', 'PUBLISH', 'ARCHIVE'
  label: string;
  guardExpression?: string; // SpEL expression, e.g. "attributes['total_amount'] < 50000"
  requiredRole?: string;    // e.g. "ROLE_ADMIN", "ROLE_SUPERVISOR"
  actionType?: string;      // Transactional Outbox async side-effect, e.g. "NOTIFICATION_DISPATCH"
}

export interface FsmWorkflowDefinition {
  entityTypeId: string | number;
  entityTypeSystemName: string;
  version: number;
  initialState: string;
  states: FsmStateNode[];
  transitions: FsmTransitionEdge[];
}

export interface DynamicFormLivePreviewValues {
  [key: string]: unknown;
}
