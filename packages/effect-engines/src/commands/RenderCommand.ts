export interface CommandExecutionResult {
  success: boolean;
  durationMs: number;
  outputArtifactPath?: string;
  error?: string;
}

/**
 * RenderCommand:
 * Implements the Command Pattern for discrete, inspectable, and dry-runnable media operations.
 */
export interface RenderCommand {
  readonly id: string;
  readonly name: string;
  estimateVRAMBytes?(): number;
  dryRunValidate?(): { valid: boolean; reason?: string };
  execute(): Promise<CommandExecutionResult>;
}

export class MacroRenderCommand implements RenderCommand {
  public readonly id: string;
  public readonly name: string;
  private commands: RenderCommand[] = [];

  constructor(id: string, name: string, commands: RenderCommand[] = []) {
    this.id = id;
    this.name = name;
    this.commands = commands;
  }

  public add(command: RenderCommand): void {
    this.commands.push(command);
  }

  public dryRunValidate(): { valid: boolean; reason?: string } {
    for (const cmd of this.commands) {
      if (cmd.dryRunValidate) {
        const res = cmd.dryRunValidate();
        if (!res.valid) return res;
      }
    }
    return { valid: true };
  }

  public async execute(): Promise<CommandExecutionResult> {
    const start = Date.now();
    for (const cmd of this.commands) {
      const res = await cmd.execute();
      if (!res.success) {
        return {
          success: false,
          durationMs: Date.now() - start,
          error: `Macro command failed at step "${cmd.name}": ${res.error}`,
        };
      }
    }
    return {
      success: true,
      durationMs: Date.now() - start,
    };
  }
}
