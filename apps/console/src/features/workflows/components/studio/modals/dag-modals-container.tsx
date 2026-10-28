import React from 'react';
import { DagEdgeConditionModal, type EdgeConditionModalData } from './dag-edge-condition-modal';
import { WorkflowIrDialog } from './workflow-ir-dialog';
import { WorkflowDryRunModal } from './workflow-dry-run-modal';
import { WorkflowSimulationModal } from './workflow-simulation-modal';
import { WorkflowVariableWatchDrawer } from './workflow-variable-watch-drawer';
import { HotMigrationModal } from '@/features/workflows/components/migration/hot-migration-modal';
import type { WorkflowIR } from '../utils/workflow-ir-converter';

export interface DagModalsContainerProps {
  isReadOnly?: boolean;
  isExecutionMode?: boolean;
  executionId?: string | null;
  workflowKey?: string;
  // Edge Condition Modal
  isEdgeConditionOpen: boolean;
  onEdgeConditionOpenChange: (open: boolean) => void;
  selectedEdgeData: EdgeConditionModalData | null;
  availableTaskRefs: string[];
  onSaveEdgeCondition: (edgeId: string, updates: { label?: string; condition?: string; decisionCase?: string; isDefaultCase?: boolean }) => void;
  // IR Import/Export Dialog
  isIrDialogOpen: boolean;
  onIrDialogOpenChange: (open: boolean) => void;
  irDialogMode: 'export' | 'import';
  irDialogContent: string;
  onApplyImportedJson: (importedIr: any) => void;
  // Dry Run Modal
  isDryRunOpen: boolean;
  onDryRunOpenChange: (open: boolean) => void;
  workflowIR: WorkflowIR;
  onSimulationSuccess: (simResult: any) => void;
  // Simulation Blueprint Modal
  isSimulationModalOpen: boolean;
  onSimulationModalOpenChange: (open: boolean) => void;
  onStartSimulation: (simExecId: string) => void;
  // Variable Watch Drawer
  isVariableWatchOpen: boolean;
  onVariableWatchOpenChange: (open: boolean) => void;
  workflowStatus?: string;
  pausedAtNode?: string | null;
  breakpoints: string[];
  onRemoveBreakpoint: (ref: string) => void;
  variablesSnapshot: Record<string, unknown>;
  taskOutputs: Record<string, unknown>;
  onDebuggerStepOver: () => void;
  onDebuggerPause: () => void;
  onDebuggerResume: () => void;
  isStepping?: boolean;
  // Hot Migration Modal
  isHotMigrationOpen: boolean;
  onCloseHotMigration: () => void;
}

export const DagModalsContainer: React.FC<DagModalsContainerProps> = ({
  isReadOnly,
  isExecutionMode,
  executionId,
  workflowKey,
  isEdgeConditionOpen,
  onEdgeConditionOpenChange,
  selectedEdgeData,
  availableTaskRefs,
  onSaveEdgeCondition,
  isIrDialogOpen,
  onIrDialogOpenChange,
  irDialogMode,
  irDialogContent,
  onApplyImportedJson,
  isDryRunOpen,
  onDryRunOpenChange,
  workflowIR,
  onSimulationSuccess,
  isSimulationModalOpen,
  onSimulationModalOpenChange,
  onStartSimulation,
  isVariableWatchOpen,
  onVariableWatchOpenChange,
  workflowStatus,
  pausedAtNode,
  breakpoints,
  onRemoveBreakpoint,
  variablesSnapshot,
  taskOutputs,
  onDebuggerStepOver,
  onDebuggerPause,
  onDebuggerResume,
  isStepping,
  isHotMigrationOpen,
  onCloseHotMigration,
}) => {
  return (
    <>
      {!isReadOnly && (
        <>
          <DagEdgeConditionModal
            open={isEdgeConditionOpen}
            onOpenChange={onEdgeConditionOpenChange}
            edgeData={selectedEdgeData}
            availableTaskRefs={availableTaskRefs}
            onSaveEdgeCondition={onSaveEdgeCondition}
          />
          <WorkflowIrDialog
            open={isIrDialogOpen}
            onOpenChange={onIrDialogOpenChange}
            mode={irDialogMode}
            initialJson={irDialogContent}
            onImportJson={onApplyImportedJson}
          />
          <WorkflowDryRunModal
            open={isDryRunOpen}
            onOpenChange={onDryRunOpenChange}
            workflowIR={workflowIR}
            onSimulationSuccess={onSimulationSuccess}
          />
          <WorkflowSimulationModal
            open={isSimulationModalOpen}
            onOpenChange={onSimulationModalOpenChange}
            onStartSimulation={onStartSimulation}
          />
        </>
      )}

      {isExecutionMode && (
        <WorkflowVariableWatchDrawer
          open={isVariableWatchOpen}
          onOpenChange={onVariableWatchOpenChange}
          executionId={executionId}
          workflowStatus={workflowStatus}
          pausedAtNode={pausedAtNode}
          breakpoints={breakpoints}
          onRemoveBreakpoint={onRemoveBreakpoint}
          variablesSnapshot={variablesSnapshot}
          taskOutputs={taskOutputs}
          onStepOver={onDebuggerStepOver}
          onPause={onDebuggerPause}
          onResume={onDebuggerResume}
          isStepping={isStepping}
        />
      )}

      {executionId && (
        <HotMigrationModal
          isOpen={isHotMigrationOpen}
          onClose={onCloseHotMigration}
          workflowKey={workflowKey || 'order-fulfillment-v1'}
          executionId={executionId}
          currentVersion={1}
          onMigrationSuccess={onCloseHotMigration}
        />
      )}
    </>
  );
};
