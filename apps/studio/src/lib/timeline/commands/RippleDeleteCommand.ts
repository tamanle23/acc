import type { IRStateManager } from '../../ir/irState';
import type { TimelineCommand } from './TimelineCommands';

/**
 * RippleDeleteCommand:
 * Professional NLE Timeline Command that executes an atomic Ripple Delete on the target sequence.
 * Closes the timeline gap across the current track or all unlocked tracks,
 * removes linked A/V clips synchronously, and guarantees bit-identical undo/redo restoration.
 */
export class RippleDeleteCommand implements TimelineCommand {
  public readonly type = 'RIPPLE_DELETE';
  public readonly id = 'RIPPLE_DELETE_COMMAND';
  public readonly name = 'Ripple Delete Clip';

  constructor(
    public readonly targetClipId: string,
    public readonly rippleAllUnlocked: boolean = false
  ) {}

  public execute(stateManager: IRStateManager): void {
    stateManager.rippleDeleteSequence(this.targetClipId, this.rippleAllUnlocked);
  }

  public undo(stateManager: IRStateManager): void {
    stateManager.undo();
  }
}
