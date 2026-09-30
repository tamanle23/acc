import { Logger } from './logger';

export interface FilterNodeOptions {
  filter: string;
  inputs?: string[];
  outputs?: string[];
  options?: string | Record<string, string | number | boolean | undefined>;
}

export interface FilterNode {
  id: string;
  filter: string;
  inputs: string[];
  outputs: string[];
  options: string;
  rawString: string;
}

/**
 * FFmpegFilterGraph
 * Object-oriented DAG builder for compiling safe, collision-free FFmpeg filtergraphs.
 */
export class FFmpegFilterGraph {
  private nodes: FilterNode[] = [];
  private streamCounter = 0;
  private nodeCounter = 0;

  /**
   * Helper to format a stream label with brackets, e.g. '0:v' -> '[0:v]'
   */
  public static normalizeLabel(label: string): string {
    const trimmed = label.trim();
    if (!trimmed) return '';
    if (trimmed.startsWith('[') && trimmed.endsWith(']')) {
      return trimmed;
    }
    return `[${trimmed}]`;
  }

  /**
   * Helper to strip brackets from a label, e.g. '[0:v]' -> '0:v'
   */
  public static stripLabel(label: string): string {
    const trimmed = label.trim();
    if (trimmed.startsWith('[') && trimmed.endsWith(']')) {
      return trimmed.slice(1, -1);
    }
    return trimmed;
  }

  /**
   * Generates a collision-free stream label.
   */
  public createStreamLabel(prefix: string = 'v'): string {
    this.streamCounter++;
    return `[${prefix}_node_${this.streamCounter}]`;
  }

  /**
   * Serializes an options object or string into FFmpeg filter syntax (key=value:key2=value2).
   */
  public serializeOptions(options?: string | Record<string, string | number | boolean | undefined>): string {
    if (!options) return '';
    if (typeof options === 'string') return options;

    return Object.entries(options)
      .filter(([_, val]) => val !== undefined)
      .map(([key, val]) => `${key}=${val}`)
      .join(':');
  }

  /**
   * Adds a discrete filter node into the graph.
   */
  public addNode(config: FilterNodeOptions): FilterNode {
    const nodeId = `node_${++this.nodeCounter}`;
    const normalizedInputs = (config.inputs || []).map(FFmpegFilterGraph.normalizeLabel);
    const normalizedOutputs = (config.outputs || []).map(FFmpegFilterGraph.normalizeLabel);
    const optionsStr = this.serializeOptions(config.options);

    const inputPart = normalizedInputs.join('');
    const outputPart = normalizedOutputs.join('');
    const filterBody = optionsStr ? `${config.filter}=${optionsStr}` : config.filter;
    const rawString = `${inputPart}${filterBody}${outputPart}`;

    const node: FilterNode = {
      id: nodeId,
      filter: config.filter,
      inputs: normalizedInputs,
      outputs: normalizedOutputs,
      options: optionsStr,
      rawString,
    };

    this.nodes.push(node);
    Logger.debug('FFmpegFilterGraph', `Added filter node ${nodeId}: ${rawString}`);
    return node;
  }

  /**
   * Helper for linear filter chains: connects an existing stream to a new filter
   * and automatically generates a unique output stream label.
   */
  public chain(
    sourceStream: string,
    filter: string,
    options?: string | Record<string, string | number | boolean | undefined>,
    outputPrefix: string = 'v'
  ): { node: FilterNode; outputStream: string } {
    const outputStream = this.createStreamLabel(outputPrefix);
    const node = this.addNode({
      inputs: [sourceStream],
      filter,
      options,
      outputs: [outputStream],
    });
    return { node, outputStream };
  }

  /**
   * Compiles the graph into a single filter_complex string.
   */
  public compile(): string {
    this.validate();
    return this.nodes.map(n => n.rawString).join(';');
  }

  /**
   * Returns array of filter segment strings for fluent-ffmpeg .complexFilter(...)
   */
  public toArray(): string[] {
    this.validate();
    return this.nodes.map(n => n.rawString);
  }

  /**
   * Validates the graph for stream consistency and obvious syntax collisions.
   */
  public validate(): void {
    const producedStreams = new Set<string>();

    for (const node of this.nodes) {
      for (const output of node.outputs) {
        if (producedStreams.has(output)) {
          throw new Error(
            `[FFmpegFilterGraph] Stream collision detected! Stream label "${output}" was produced more than once.`
          );
        }
        producedStreams.add(output);
      }
    }
  }

  /**
   * Returns all nodes currently registered in the graph.
   */
  public getNodes(): ReadonlyArray<FilterNode> {
    return this.nodes;
  }

  /**
   * Clears all nodes from the graph.
   */
  public clear(): void {
    this.nodes = [];
    this.streamCounter = 0;
    this.nodeCounter = 0;
  }
}
