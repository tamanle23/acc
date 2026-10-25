import type { ResolvedSequence } from '../types/VideoIR';

export interface IntervalEntry {
  sequence: ResolvedSequence;
  low: number;
  high: number;
  max: number;
  left?: IntervalEntry;
  right?: IntervalEntry;
}

/**
 * IntervalTreeIndex:
 * Organizes resolved timeline sequences into an augmented Interval Tree (O(log M) lookup).
 * Powers sub-16ms interactive seeking and dirty-rectangle culling in video editing GUI.
 */
export class IntervalTreeIndex {
  private root?: IntervalEntry;

  constructor(sequences: ResolvedSequence[]) {
    this.build(sequences);
  }

  private build(sequences: ResolvedSequence[]): void {
    const sorted = [...sequences].sort((a, b) => a.startFrame - b.startFrame);
    this.root = this.buildSubtree(sorted);
  }

  private buildSubtree(seqs: ResolvedSequence[]): IntervalEntry | undefined {
    if (seqs.length === 0) return undefined;

    const mid = Math.floor(seqs.length / 2);
    const seq = seqs[mid];
    const node: IntervalEntry = {
      sequence: seq,
      low: seq.startFrame,
      high: seq.endFrame,
      max: seq.endFrame,
    };

    node.left = this.buildSubtree(seqs.slice(0, mid));
    node.right = this.buildSubtree(seqs.slice(mid + 1));

    if (node.left && node.left.max > node.max) {
      node.max = node.left.max;
    }
    if (node.right && node.right.max > node.max) {
      node.max = node.right.max;
    }

    return node;
  }

  /**
   * Queries all active sequences that intersect with the given frame integer t.
   */
  public queryActive(frame: number): ResolvedSequence[] {
    const results: ResolvedSequence[] = [];
    this.searchNode(this.root, frame, results);
    return results;
  }

  private searchNode(node: IntervalEntry | undefined, frame: number, results: ResolvedSequence[]): void {
    if (!node) return;

    if (frame >= node.low && frame <= node.high) {
      results.push(node.sequence);
    }

    if (node.left && node.left.max >= frame) {
      this.searchNode(node.left, frame, results);
    }

    if (node.right && node.low <= frame) {
      this.searchNode(node.right, frame, results);
    }
  }
}
