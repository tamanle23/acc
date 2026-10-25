import { IRStateManager } from '../../ir/irState';

export interface TimelineCommand {
  readonly type: string;
  execute(stateManager: IRStateManager): void;
}

export class SelectClipCommand implements TimelineCommand {
  public readonly type = 'SELECT_CLIP';

  constructor(public readonly clipId: string | null) {}

  public execute(stateManager: IRStateManager): void {
    if (!this.clipId) {
      stateManager.setSelectedSequenceId(null);
      return;
    }
    stateManager.setSelectedSequenceId(this.clipId);
    stateManager.setInspectorMode('sequence');

    // Find and select corresponding track
    const tracks = stateManager.getState().timeline?.tracks || [];
    for (const track of tracks) {
      if (track.sequences?.some((s) => s.id === this.clipId)) {
        stateManager.setSelectedTrackId(track.id);
        break;
      }
    }
  }
}

export class MoveClipCommand implements TimelineCommand {
  public readonly type = 'MOVE_CLIP';

  constructor(
    public readonly clipId: string,
    public readonly targetTrackId: string,
    public readonly targetStartFrame: number
  ) {}

  public execute(stateManager: IRStateManager): void {
    stateManager.moveSequence(
      this.clipId,
      this.targetTrackId,
      Math.max(0, Math.round(this.targetStartFrame))
    );
  }
}

export class TrimClipCommand implements TimelineCommand {
  public readonly type = 'TRIM_CLIP';

  constructor(
    public readonly clipId: string,
    public readonly handle: 'start' | 'end',
    public readonly deltaFrames: number
  ) {}

  public execute(stateManager: IRStateManager): void {
    const delta = Math.round(this.deltaFrames);
    if (delta === 0) return;

    if (this.handle === 'start') {
      stateManager.trimSequence(this.clipId, delta, -delta);
    } else {
      stateManager.trimSequence(this.clipId, 0, delta);
    }
  }
}

export class RazorCutCommand implements TimelineCommand {
  public readonly type = 'RAZOR_CUT';

  constructor(
    public readonly clipId: string,
    public readonly splitFrame: number
  ) {}

  public execute(stateManager: IRStateManager): void {
    stateManager.splitSequence(this.clipId, Math.round(this.splitFrame));
  }
}

export class TimelineCommandDispatcher {
  private static instance: TimelineCommandDispatcher | null = null;
  private history: TimelineCommand[] = [];

  public static getInstance(): TimelineCommandDispatcher {
    if (!TimelineCommandDispatcher.instance) {
      TimelineCommandDispatcher.instance = new TimelineCommandDispatcher();
    }
    return TimelineCommandDispatcher.instance;
  }

  public dispatch(command: TimelineCommand): void {
    const stateManager = IRStateManager.getInstance();
    command.execute(stateManager);
    this.history.push(command);
  }

  public getHistory(): readonly TimelineCommand[] {
    return this.history;
  }

  public clearHistory(): void {
    this.history = [];
  }
}
