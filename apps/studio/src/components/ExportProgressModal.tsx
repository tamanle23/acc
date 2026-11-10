import { Video } from 'lucide-solid';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from './ui/dialog';
import { Progress } from './ui/progress';
import { Button } from './ui/button';
import { Badge } from './ui/badge';

export interface ExportProgressModalProps {
  isExporting: boolean;
  exportProgress: number;
  onCancelExport: () => void;
}

export function ExportProgressModal(props: ExportProgressModalProps) {
  return (
    <Dialog
      open={props.isExporting}
      onOpenChange={(open) => {
        if (!open) props.onCancelExport();
      }}
    >
      <DialogContent class="max-w-sm glass-panel border-glass-border text-foreground">
        <DialogHeader>
          <div class="flex items-center justify-between">
            <div class="flex items-center gap-2">
              <Video class="w-4 h-4 text-accent-theme" />
              <DialogTitle>Video Export</DialogTitle>
            </div>
            <Badge
              variant="outline"
              class="font-mono text-accent-theme bg-accent-theme/10 border-accent-theme/30"
            >
              {props.exportProgress}%
            </Badge>
          </div>
          <DialogDescription>Encoding Video IR timeline into MP4 ...</DialogDescription>
        </DialogHeader>

        <div class="py-3">
          <Progress value={props.exportProgress} class="h-2.5" />
        </div>

        <DialogFooter>
          <Button variant="destructive" size="sm" onClick={props.onCancelExport}>
            Cancel Export
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
