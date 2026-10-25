import type { ExtendedPipelineIR } from '@acc/ir';

export class MetadataArchiver {
  public static generateFFmpegMetadataArgs(ir: ExtendedPipelineIR): string[] {
    const args: string[] = [
      '-metadata', `title=${ir.metadata.title}`,
      '-metadata', `artist=${ir.metadata.author || 'ACC Multi-Pipeline Engine'}`,
      '-metadata', `comment=${ir.metadata.tags.join(',')}`,
      '-movflags', '+faststart+use_metadata_tags',
    ];
    return args;
  }
}
