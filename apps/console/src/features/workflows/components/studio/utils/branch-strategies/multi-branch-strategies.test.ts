import { describe, it, expect } from 'vitest';
import { multiBranchRegistry } from './multi-branch-registry';
import { SwitchBranchStrategy } from './strategies/switch-branch-strategy';
import { ForkJoinBranchStrategy } from './strategies/fork-join-branch-strategy';
import { DoWhileBranchStrategy } from './strategies/do-while-branch-strategy';
import { type Node, type Edge } from '@xyflow/react';
import { type DagNodeData } from '../../canvas/dag-node';
import './index'; // triggers registration

describe('Multi-Branch Strategy Engine', () => {
  it('correctly registers and checks multi-branch supported node types', () => {
    expect(multiBranchRegistry.supports('SWITCH')).toBe(true);
    expect(multiBranchRegistry.supports('FORK_JOIN')).toBe(true);
    expect(multiBranchRegistry.supports('DO_WHILE')).toBe(true);
    expect(multiBranchRegistry.supports('HUMAN')).toBe(false); // HUMAN is an atomic review gate, not multi-branch
    expect(multiBranchRegistry.supports('SIMPLE')).toBe(false);
    expect(multiBranchRegistry.supports('HTTP')).toBe(false);
    expect(multiBranchRegistry.supports(undefined)).toBe(false);
  });

  describe('SwitchBranchStrategy', () => {
    const strategy = new SwitchBranchStrategy();

    it('retrieves all active cases plus the default fallback branch', () => {
      const data: DagNodeData = {
        taskReferenceName: 'switch_node',
        taskType: 'SWITCH',
        decisionCases: {
          case_1: ['task_1'],
          case_2: ['task_2'],
        },
        defaultCase: ['task_default'],
      };

      const branches = strategy.getBranches(data);
      expect(branches).toHaveLength(3);

      const case1 = branches.find((b) => b.id === 'case_1');
      const defaultBranch = branches.find((b) => b.id === 'default');

      expect(case1).toBeDefined();
      expect(case1?.handleId).toBe('case-case_1');
      expect(case1?.targetTaskRef).toBe('task_1');
      expect(case1?.isRemovable).toBe(true);

      expect(defaultBranch).toBeDefined();
      expect(defaultBranch?.handleId).toBe('case-default');
      expect(defaultBranch?.targetTaskRef).toBe('task_default');
      expect(defaultBranch?.isRemovable).toBe(false);
      expect(defaultBranch?.isDefault).toBe(true);
    });

    it('adds a new decision branch and updates decisionCases cleanly', () => {
      const data: DagNodeData = {
        taskReferenceName: 'switch_node',
        taskType: 'SWITCH',
        decisionCases: {
          case_1: ['task_1'],
          case_2: ['task_2'],
        },
        defaultCase: ['task_default'],
      };

      const result = strategy.addBranch(data);
      expect(result.newBranch.id).toBe('case_3');
      expect(result.newBranch.handleId).toBe('case-case_3');
      expect(result.newBranch.targetTaskRef).toMatch(/^case_3_action_\d+$/);

      const updatedCases = result.updatedParentData.decisionCases!;
      expect(Object.keys(updatedCases)).toContain('case_3');
      expect(updatedCases['case_3']).toContain(result.newBranch.targetTaskRef);
    });

    it('allows named branch additions and guards default removal', () => {
      const data: DagNodeData = {
        taskReferenceName: 'switch_node',
        taskType: 'SWITCH',
        decisionCases: {
          GOLD: ['gold_task'],
        },
        defaultCase: ['default_task'],
      };

      const addResult = strategy.addBranch(data, { name: 'PLATINUM' });
      expect(addResult.newBranch.id).toBe('PLATINUM');
      expect(addResult.newBranch.handleId).toBe('case-PLATINUM');

      expect(() => strategy.removeBranch(data, 'default')).toThrow('Default fallback branch cannot be removed');

      const removeResult = strategy.removeBranch(data, 'GOLD');
      expect(removeResult.removedBranch.id).toBe('GOLD');
      expect(removeResult.prunedTaskRefs).toEqual(['gold_task']);
      expect(removeResult.updatedParentData.decisionCases?.['GOLD']).toBeUndefined();
    });

    it('finds downstream EXCLUSIVE_JOIN barrier and synchronizes joinOn', () => {
      const parentNode: Node<DagNodeData> = {
        id: 'switch-node',
        type: 'dagNode',
        position: { x: 100, y: 100 },
        data: { taskReferenceName: 'switch_router', taskType: 'SWITCH' },
      };
      const actionNode: Node<DagNodeData> = {
        id: 'action-1',
        type: 'dagNode',
        position: { x: 300, y: 100 },
        data: { taskReferenceName: 'action_1', taskType: 'SIMPLE' },
      };
      const ejNode: Node<DagNodeData> = {
        id: 'ej-node',
        type: 'dagNode',
        position: { x: 500, y: 100 },
        data: {
          taskReferenceName: 'exclusive_join',
          taskType: 'EXCLUSIVE_JOIN',
          joinOn: ['action_1'],
        },
      };

      const edges: Edge[] = [
        { id: 'e1', source: 'switch-node', target: 'action-1' },
        { id: 'e2', source: 'action-1', target: 'ej-node' },
      ];

      const foundBarrier = strategy.findBarrierNode(parentNode, [parentNode, actionNode, ejNode], edges);
      expect(foundBarrier?.id).toBe('ej-node');

      const addSync = strategy.syncBarrierNode(ejNode, 'add', 'action_2');
      expect(addSync.joinOn).toEqual(['action_1', 'action_2']);

      const removeSync = strategy.syncBarrierNode(ejNode, 'remove', 'action_1');
      expect(removeSync.joinOn).toEqual([]);
    });
  });

  describe('ForkJoinBranchStrategy', () => {
    const strategy = new ForkJoinBranchStrategy();

    it('retrieves branches and enforces minimum parallel branches on removal', () => {
      const data: DagNodeData = {
        taskReferenceName: 'fork_node',
        taskType: 'FORK_JOIN',
        forkTasks: [['branch1_task'], ['branch2_task']],
      };

      const branches = strategy.getBranches(data);
      expect(branches).toHaveLength(2);
      expect(branches.every((b) => !b.isRemovable)).toBe(true);

      // Attempting to remove below 2 branches throws
      expect(() => strategy.removeBranch(data, 'branch_1')).toThrow('Cannot reduce FORK_JOIN below 2 parallel branches');

      // Adding 3rd branch
      const addResult = strategy.addBranch(data);
      expect(addResult.newBranch.id).toBe('branch_3');
      expect(addResult.updatedParentData.forkTasks).toHaveLength(3);

      const threeBranchesData: DagNodeData = {
        ...data,
        forkTasks: addResult.updatedParentData.forkTasks,
      };

      const removeResult = strategy.removeBranch(threeBranchesData, 'branch_3');
      expect(removeResult.updatedParentData.forkTasks).toHaveLength(2);
    });

    it('finds downstream JOIN barrier and synchronizes joinOn', () => {
      const parentNode: Node<DagNodeData> = {
        id: 'fork-node',
        type: 'dagNode',
        position: { x: 100, y: 100 },
        data: { taskReferenceName: 'fork_task', taskType: 'FORK_JOIN' },
      };
      const joinNode: Node<DagNodeData> = {
        id: 'join-node',
        type: 'dagNode',
        position: { x: 500, y: 100 },
        data: { taskReferenceName: 'join_barrier', taskType: 'JOIN', joinOn: ['b1', 'b2'] },
      };
      const edges: Edge[] = [
        { id: 'e1', source: 'fork-node', target: 'join-node' },
      ];

      const foundBarrier = strategy.findBarrierNode(parentNode, [parentNode, joinNode], edges);
      expect(foundBarrier?.id).toBe('join-node');

      const addSync = strategy.syncBarrierNode(joinNode, 'add', 'b3');
      expect(addSync.joinOn).toEqual(['b1', 'b2', 'b3']);
    });
  });

  describe('DoWhileBranchStrategy', () => {
    const strategy = new DoWhileBranchStrategy();

    it('manages sequential loop body steps while preserving loop exit', () => {
      const data: DagNodeData = {
        taskReferenceName: 'loop_node',
        taskType: 'DO_WHILE',
        loopOver: ['step_1'],
      };

      const branches = strategy.getBranches(data);
      expect(branches).toHaveLength(2); // 1 step + loop-exit

      const addResult = strategy.addBranch(data);
      expect(addResult.updatedParentData.loopOver).toHaveLength(2);

      const twoStepData: DagNodeData = {
        ...data,
        loopOver: addResult.updatedParentData.loopOver,
      };

      const removeResult = strategy.removeBranch(twoStepData, 'step_2');
      expect(removeResult.updatedParentData.loopOver).toHaveLength(1);

      expect(() => strategy.removeBranch(data, 'step_1')).toThrow('Cannot reduce DO_WHILE below 1 body steps');
      expect(() => strategy.removeBranch(data, 'loop-exit')).toThrow('Loop exit port cannot be removed');
    });
  });
});
