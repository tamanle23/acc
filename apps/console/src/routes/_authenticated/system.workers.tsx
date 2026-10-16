import { createFileRoute } from '@tanstack/react-router';
import { WorkerFleetFeature } from '@/features/workers';

export const Route = createFileRoute('/_authenticated/system/workers')({
  component: SystemWorkersPage,
});

function SystemWorkersPage() {
  return <WorkerFleetFeature />;
}
