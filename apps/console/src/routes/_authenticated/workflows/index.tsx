import { createFileRoute } from '@tanstack/react-router';
import { WorkflowsFeature } from '@/features/workflows';

export const Route = createFileRoute('/_authenticated/workflows/')({
  component: WorkflowsFeature,
});
