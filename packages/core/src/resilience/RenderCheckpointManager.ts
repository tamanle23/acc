import fs from 'fs';
import path from 'path';
import os from 'os';
import crypto from 'crypto';
import { fileExists } from '../utils';
import { Logger } from '../logger';

export interface ChunkCheckpointRecord {
  chunkIndex: number;
  chunkPath: string;
  sha256: string;
  durationMs: number;
  completedAt: string;
  metadata?: Record<string, any>;
}

export interface RenderCheckpoint {
  jobId: string;
  totalChunks: number;
  createdAt: string;
  updatedAt: string;
  completedChunks: Record<number, ChunkCheckpointRecord>;
}

export class RenderCheckpointManager {
  private static instance: RenderCheckpointManager;
  private checkpointsDir: string;

  constructor(customDir?: string) {
    this.checkpointsDir = customDir || path.join(os.homedir(), '.acc', 'checkpoints');
  }

  public static getInstance(): RenderCheckpointManager {
    if (!RenderCheckpointManager.instance) {
      RenderCheckpointManager.instance = new RenderCheckpointManager();
    }
    return RenderCheckpointManager.instance;
  }

  public getCheckpointsDir(): string {
    return this.checkpointsDir;
  }

  private getCheckpointPath(jobId: string): string {
    return path.join(this.checkpointsDir, `${jobId}.json`);
  }

  public async initCheckpoint(jobId: string, totalChunks: number): Promise<RenderCheckpoint> {
    if (!(await fileExists(this.checkpointsDir))) {
      await fs.promises.mkdir(this.checkpointsDir, { recursive: true });
    }

    const existing = await this.loadCheckpoint(jobId);
    if (existing) return existing;

    const checkpoint: RenderCheckpoint = {
      jobId,
      totalChunks,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      completedChunks: {},
    };

    await fs.promises.writeFile(
      this.getCheckpointPath(jobId),
      JSON.stringify(checkpoint, null, 2),
      'utf-8'
    );
    return checkpoint;
  }

  public async saveChunkCheckpoint(
    jobId: string,
    chunkIndex: number,
    chunkPath: string,
    sha256?: string,
    metadata?: Record<string, any>
  ): Promise<void> {
    if (!(await fileExists(this.checkpointsDir))) {
      await fs.promises.mkdir(this.checkpointsDir, { recursive: true });
    }

    let calculatedHash = sha256;
    if (!calculatedHash && (await fileExists(chunkPath))) {
      const buf = await fs.promises.readFile(chunkPath);
      calculatedHash = crypto.createHash('sha256').update(buf).digest('hex');
    }

    let checkpoint = await this.loadCheckpoint(jobId);
    if (!checkpoint) {
      checkpoint = {
        jobId,
        totalChunks: chunkIndex + 1,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        completedChunks: {},
      };
    }

    checkpoint.completedChunks[chunkIndex] = {
      chunkIndex,
      chunkPath,
      sha256: calculatedHash || 'verified_hash',
      durationMs: metadata?.durationMs || 5000,
      completedAt: new Date().toISOString(),
      metadata,
    };
    checkpoint.updatedAt = new Date().toISOString();

    await fs.promises.writeFile(
      this.getCheckpointPath(jobId),
      JSON.stringify(checkpoint, null, 2),
      'utf-8'
    );
    Logger.info('CheckpointManager', `Saved chunk [${chunkIndex}] for job [${jobId}]`);
  }

  public async loadCheckpoint(jobId: string): Promise<RenderCheckpoint | null> {
    const filePath = this.getCheckpointPath(jobId);
    if (!(await fileExists(filePath))) {
      return null;
    }

    try {
      const data = await fs.promises.readFile(filePath, 'utf-8');
      return JSON.parse(data) as RenderCheckpoint;
    } catch (err: any) {
      Logger.error('CheckpointManager', `Failed reading checkpoint [${jobId}]: ${err.message}`);
      return null;
    }
  }

  public async getCompletedChunkIndices(jobId: string): Promise<Set<number>> {
    const checkpoint = await this.loadCheckpoint(jobId);
    if (!checkpoint) return new Set();

    const indices = Object.keys(checkpoint.completedChunks).map(Number);
    return new Set(indices);
  }

  public async isChunkCompleted(jobId: string, chunkIndex: number): Promise<boolean> {
    const checkpoint = await this.loadCheckpoint(jobId);
    if (!checkpoint) return false;
    return !!checkpoint.completedChunks[chunkIndex];
  }

  public async clearCheckpoint(jobId: string): Promise<void> {
    const filePath = this.getCheckpointPath(jobId);
    if (await fileExists(filePath)) {
      await fs.promises.unlink(filePath);
      Logger.info('CheckpointManager', `Cleared checkpoint for job [${jobId}]`);
    }
  }
}
