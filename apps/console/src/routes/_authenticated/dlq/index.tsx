import { createFileRoute } from '@tanstack/react-router';
import { DlqFeature } from '@/features/dlq';

export const Route = createFileRoute('/_authenticated/dlq/')({
  component: DlqFeature,
});
