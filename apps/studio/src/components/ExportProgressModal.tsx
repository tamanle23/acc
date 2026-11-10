import { Video, X } from 'lucide-solid';
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
  onOpenChange: (open: boolean) => void;
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
        <DialogHeader class="p-4 border-b shrink-0 flex flex-row items-center justify-between px-5 py-3 gap-4">
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
            <Button
              variant="ghost"
              size="icon"
              onClick={() => props.onOpenChange(false)}
              class="h-7 w-7 rounded-full text-muted-foreground hover:text-foreground"
            >
              <X class="w-4 h-4" />
            </Button>
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
