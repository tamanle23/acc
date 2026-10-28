import React from 'react';
import { Video } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  Progress,
  Button,
  Badge,
} from './ui';

export interface ExportProgressModalProps {
  isExporting: boolean;
  exportProgress: number;
  onCancelExport: () => void;
}

export const ExportProgressModal: React.FC<ExportProgressModalProps> = ({
  isExporting,
  exportProgress,
  onCancelExport,
}) => {
  return (
    <Dialog
      open={isExporting}
      onOpenChange={(open) => {
        if (!open) onCancelExport();
      }}
    >
      <DialogContent className="max-w-sm glass-panel border-glass-border text-foreground">
        <DialogHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Video className="w-4 h-4 text-accent-theme" />
              <DialogTitle>Video Export</DialogTitle>
            </div>
            <Badge
              variant="outline"
              className="font-mono text-accent-theme bg-accent-theme/10 border-accent-theme/30"
            >
              {exportProgress}%
            </Badge>
          </div>
          <DialogDescription>Encoding Video IR timeline into MP4 ...</DialogDescription>
        </DialogHeader>

        <div className="py-3">
          <Progress value={exportProgress} className="h-2.5" />
        </div>

        <DialogFooter>
          <Button variant="destructive" size="sm" onClick={onCancelExport}>
            Cancel Export
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
