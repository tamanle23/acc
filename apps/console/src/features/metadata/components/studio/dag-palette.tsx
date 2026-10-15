import React, { useState, useMemo } from 'react';
import {
  Play,
  Split,
  GitMerge,
  Clock,
  Repeat,
  GitFork,
  Globe,
  Database,
  Radio,
  Zap,
  Braces,
  Code,
  Variable,
  UserCheck,
  Bot,
  Cpu,
  StopCircle,
  Layers,
  PlaySquare,
  MinusCircle,
  Sparkles,
  GripVertical,
  ChevronDown,
  ChevronRight,
  Search,
} from 'lucide-react';
import { type DagNodeType, type DagNodeData } from './dag-node';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';

export interface PaletteItem {
  type: DagNodeType;
  label: string;
  description: string;
  category: 'control' | 'data' | 'connectors' | 'human' | 'ai';
  icon: React.ReactNode;
  defaultData: Partial<DagNodeData>;
}

export const CATEGORIES: { id: PaletteItem['category']; label: string }[] = [
  { id: 'control', label: 'Control Flow' },
  { id: 'data', label: 'Data & Transformation' },
  { id: 'connectors', label: 'Connectors & I/O' },
  { id: 'human', label: 'Human & Governance' },
  { id: 'ai', label: 'AI & Emerging Integrations' },
];

export const PALETTE_ITEMS: PaletteItem[] = [
  // 1. Control Flow (9)
  {
    type: 'SIMPLE',
    label: 'Simple Task',
    description: 'Dispatches job to worker queue',
    category: 'control',
    icon: <Play className="w-3.5 h-3.5 text-primary" />,
    defaultData: {
      taskType: 'SIMPLE',
      label: 'New Task',
      timeoutSeconds: 30,
      retryCount: 3,
    },
  },
  {
    type: 'SWITCH',
    label: 'Switch Node',
    description: 'Conditional branch router',
    category: 'control',
    icon: <Split className="w-3.5 h-3.5 text-amber-500" />,
    defaultData: {
      taskType: 'SWITCH',
      label: 'Switch Condition',
      condition: '${workflow.input.case}',
    },
  },
  {
    type: 'FORK_JOIN',
    label: 'Fork / Join',
    description: 'Parallel branch execution barrier',
    category: 'control',
    icon: <GitMerge className="w-3.5 h-3.5 text-indigo-500" />,
    defaultData: {
      taskType: 'FORK_JOIN',
      label: 'Parallel Fork',
    },
  },
  {
    type: 'DYNAMIC_FORK',
    label: 'Dynamic Fork',
    description: 'Runtime generated parallel tasks',
    category: 'control',
    icon: <GitFork className="w-3.5 h-3.5 text-purple-500" />,
    defaultData: {
      taskType: 'DYNAMIC_FORK',
      label: 'Dynamic Fork',
    },
  },
  {
    type: 'WAIT',
    label: 'Wait / Timer',
    description: 'Pause execution for duration or event',
    category: 'control',
    icon: <Clock className="w-3.5 h-3.5 text-sky-500" />,
    defaultData: {
      taskType: 'WAIT',
      label: 'Wait Timer',
      timeoutSeconds: 60,
    },
  },
  {
    type: 'DO_WHILE',
    label: 'Do-While Loop',
    description: 'Iterative loop until condition met',
    category: 'control',
    icon: <Repeat className="w-3.5 h-3.5 text-emerald-500" />,
    defaultData: {
      taskType: 'DO_WHILE',
      label: 'Do-While Loop',
      condition: '${workflow.iteration < 5}',
    },
  },
  {
    type: 'TERMINATE',
    label: 'Terminate',
    description: 'Force stop workflow early',
    category: 'control',
    icon: <StopCircle className="w-3.5 h-3.5 text-red-500" />,
    defaultData: {
      taskType: 'TERMINATE',
      label: 'Terminate Flow',
      terminateParams: {
        terminationStatus: 'COMPLETED',
        terminationReason: 'Reached terminal state',
      },
    },
  },
  {
    type: 'SUB_WORKFLOW',
    label: 'Sub-Workflow',
    description: 'Execute nested child workflow',
    category: 'control',
    icon: <Layers className="w-3.5 h-3.5 text-cyan-500" />,
    defaultData: {
      taskType: 'SUB_WORKFLOW',
      label: 'Sub-Workflow',
      subWorkflowParams: {
        workflowKey: 'child-workflow',
        version: 1,
      },
    },
  },
  {
    type: 'START_WORKFLOW',
    label: 'Start Async Workflow',
    description: 'Fire-and-forget launch workflow',
    category: 'control',
    icon: <PlaySquare className="w-3.5 h-3.5 text-teal-500" />,
    defaultData: {
      taskType: 'START_WORKFLOW',
      label: 'Start Workflow',
      inputParameters: {},
    },
  },

  // 2. Data & Transformation (3)
  {
    type: 'JSON_JQ_TRANSFORM',
    label: 'JQ Transform',
    description: 'Pure JSON reshaping without worker',
    category: 'data',
    icon: <Braces className="w-3.5 h-3.5 text-orange-500" />,
    defaultData: {
      taskType: 'JSON_JQ_TRANSFORM',
      label: 'JQ Transform',
      jsonJqParams: {
        queryExpression: '{ id: .orderId, total: .amount }',
      },
    },
  },
  {
    type: 'INLINE',
    label: 'Inline Script',
    description: 'Sandboxed JS/Groovy evaluator',
    category: 'data',
    icon: <Code className="w-3.5 h-3.5 text-lime-500" />,
    defaultData: {
      taskType: 'INLINE',
      label: 'Inline Script',
      inlineParams: {
        evaluatorType: 'javascript',
        expression: 'function eval() { return true; }',
      },
    },
  },
  {
    type: 'SET_VARIABLE',
    label: 'Set Variable',
    description: 'Mutate in-memory workflow variables',
    category: 'data',
    icon: <Variable className="w-3.5 h-3.5 text-violet-500" />,
    defaultData: {
      taskType: 'SET_VARIABLE',
      label: 'Set Variables',
      inputParameters: {
        key: 'value',
      },
    },
  },

  // 3. System Connectors & I/O (5)
  {
    type: 'HTTP',
    label: 'HTTP Request',
    description: 'Direct REST/HTTP invocation',
    category: 'connectors',
    icon: <Globe className="w-3.5 h-3.5 text-blue-500" />,
    defaultData: {
      taskType: 'HTTP',
      label: 'HTTP Call',
      httpParams: {
        method: 'POST',
        url: 'https://api.example.com/v1/resource',
        timeoutSeconds: 15,
      },
    },
  },
  {
    type: 'JDBC',
    label: 'SQL Query (JDBC)',
    description: 'Database SQL query execution',
    category: 'connectors',
    icon: <Database className="w-3.5 h-3.5 text-amber-600" />,
    defaultData: {
      taskType: 'JDBC',
      label: 'Database SQL',
      jdbcParams: {
        datasourceId: 'default',
        sql: 'SELECT * FROM orders WHERE id = ?',
      },
    },
  },
  {
    type: 'KAFKA_PUBLISH',
    label: 'Kafka Publish',
    description: 'Produce event to Kafka topic',
    category: 'connectors',
    icon: <Radio className="w-3.5 h-3.5 text-pink-500" />,
    defaultData: {
      taskType: 'KAFKA_PUBLISH',
      label: 'Kafka Publish',
      kafkaParams: {
        topic: 'order-events',
        key: '${workflow.input.orderId}',
      },
    },
  },
  {
    type: 'EVENT',
    label: 'Event Signal',
    description: 'Emit or listen for system event',
    category: 'connectors',
    icon: <Zap className="w-3.5 h-3.5 text-yellow-500" />,
    defaultData: {
      taskType: 'EVENT',
      label: 'Event Signal',
      inputParameters: {
        eventType: 'CUSTOM_EVENT',
      },
    },
  },
  {
    type: 'NOOP',
    label: 'No-Op Node',
    description: 'Pass-through edge alignment router',
    category: 'connectors',
    icon: <MinusCircle className="w-3.5 h-3.5 text-slate-400" />,
    defaultData: {
      taskType: 'NOOP',
      label: 'Pass-through',
    },
  },

  // 4. Human & Governance (1)
  {
    type: 'HUMAN',
    label: 'Human Approval',
    description: 'Manual approval & review gate',
    category: 'human',
    icon: <UserCheck className="w-3.5 h-3.5 text-emerald-600" />,
    defaultData: {
      taskType: 'HUMAN',
      label: 'Human Approval',
      humanParams: {
        role: 'WORKFLOW_APPROVER',
        slaMinutes: 120,
        instructions: 'Review and approve customer verification.',
      },
    },
  },

  // 5. AI & Emerging Integrations (3)
  {
    type: 'LLM_CHAT_COMPLETE',
    label: 'LLM Prompt',
    description: 'OpenAI / Gemini / Anthropic inference',
    category: 'ai',
    icon: <Bot className="w-3.5 h-3.5 text-fuchsia-500" />,
    defaultData: {
      taskType: 'LLM_CHAT_COMPLETE',
      label: 'LLM Chat Completion',
      llmParams: {
        provider: 'openai',
        model: 'gpt-4o',
        temperature: 0.7,
        prompt: 'Analyze input data: ${workflow.input}',
      },
    },
  },
  {
    type: 'CALL_MCP_TOOL',
    label: 'MCP Tool Call',
    description: 'Model Context Protocol tool execution',
    category: 'ai',
    icon: <Cpu className="w-3.5 h-3.5 text-indigo-600" />,
    defaultData: {
      taskType: 'CALL_MCP_TOOL',
      label: 'Call MCP Tool',
      mcpParams: {
        serverName: 'system_tools',
        toolName: 'exec_action',
      },
    },
  },
  {
    type: 'DYNAMIC',
    label: 'Dynamic Task',
    description: 'Dynamic task resolved from payload',
    category: 'ai',
    icon: <Sparkles className="w-3.5 h-3.5 text-amber-400" />,
    defaultData: {
      taskType: 'DYNAMIC',
      label: 'Dynamic Node',
      inputParameters: {
        dynamicTaskNameParam: 'task_type_resolver',
      },
    },
  },
];

export function DagPalette() {
  const [searchQuery, setSearchQuery] = useState('');
  const [openCategories, setOpenCategories] = useState<Record<string, boolean>>({
    control: true,
    data: true,
    connectors: true,
    human: true,
    ai: true,
  });

  const toggleCategory = (catId: string) => {
    setOpenCategories((prev) => ({ ...prev, [catId]: !prev[catId] }));
  };

  const filteredItems = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return PALETTE_ITEMS;
    return PALETTE_ITEMS.filter(
      (item) =>
        item.label.toLowerCase().includes(q) ||
        item.description.toLowerCase().includes(q) ||
        item.type.toLowerCase().includes(q)
    );
  }, [searchQuery]);

  const onDragStart = (event: React.DragEvent, item: PaletteItem) => {
    event.dataTransfer.setData('application/dag-node-type', item.type);
    event.dataTransfer.setData('application/dag-node-data', JSON.stringify(item.defaultData));
    event.dataTransfer.effectAllowed = 'move';
  };

  return (
    <div className="flex flex-col gap-2 p-3 w-64 rounded-2xl backdrop-blur-xl bg-white/80 dark:bg-slate-900/80 border border-white/30 dark:border-white/10 shadow-xl max-h-[560px] overflow-hidden">
      {/* Header & Search */}
      <div className="flex items-center justify-between pb-1.5 border-b border-border/40 shrink-0">
        <div className="flex items-center gap-1.5">
          <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Node Palette</span>
          <Badge variant="outline" className="text-[9px] px-1.5 py-0 bg-primary/10 text-primary border-primary/20">
            23 Types
          </Badge>
        </div>
        <Badge variant="outline" className="text-[9px] px-1.5 py-0 bg-muted/40">Drag & Drop</Badge>
      </div>

      <div className="relative shrink-0">
        <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
        <Input
          placeholder="Filter nodes..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="h-8 pl-8 text-xs bg-background/50 border-white/20 dark:border-white/10"
        />
      </div>

      {/* Accordion Categories */}
      <div className="flex flex-col gap-2 overflow-y-auto pr-1 flex-1">
        {CATEGORIES.map((cat) => {
          const catItems = filteredItems.filter((item) => item.category === cat.id);
          if (catItems.length === 0) return null;
          const isOpen = searchQuery.trim().length > 0 || openCategories[cat.id];

          return (
            <div key={cat.id} className="flex flex-col">
              <button
                type="button"
                onClick={() => toggleCategory(cat.id)}
                className="flex items-center justify-between py-1 px-1.5 text-[11px] font-semibold text-muted-foreground hover:text-foreground transition-colors rounded-lg hover:bg-white/40 dark:hover:bg-slate-800/40"
              >
                <div className="flex items-center gap-1">
                  {isOpen ? (
                    <ChevronDown className="w-3 h-3 text-muted-foreground" />
                  ) : (
                    <ChevronRight className="w-3 h-3 text-muted-foreground" />
                  )}
                  <span>{cat.label}</span>
                </div>
                <span className="text-[10px] text-muted-foreground/60">{catItems.length}</span>
              </button>

              {isOpen && (
                <div className="flex flex-col gap-1 mt-1 pl-1">
                  {catItems.map((item) => (
                    <div
                      key={item.type}
                      draggable
                      onDragStart={(e) => onDragStart(e, item)}
                      className="group flex items-center gap-2 p-1.5 rounded-xl border border-white/40 dark:border-white/5 bg-white/50 dark:bg-slate-800/40 hover:bg-white/90 dark:hover:bg-slate-800/90 hover:border-primary/40 hover:shadow-md transition-all cursor-grab active:cursor-grabbing select-none"
                    >
                      <GripVertical className="w-3 h-3 text-muted-foreground/40 group-hover:text-muted-foreground shrink-0" />
                      <div className="p-1 rounded-lg bg-background/80 border border-border/50 shrink-0">
                        {item.icon}
                      </div>
                      <div className="flex flex-col min-w-0 flex-1">
                        <span className="text-xs font-semibold text-foreground truncate">{item.label}</span>
                        <span className="text-[10px] text-muted-foreground truncate">{item.description}</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
