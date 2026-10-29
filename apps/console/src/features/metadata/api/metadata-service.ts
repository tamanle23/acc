import { httpMetadataService } from './http-metadata-service';
import type { MetadataDataSource } from './metadata-data-source';

export { httpMetadataService as metadataService };
export type { MetadataDataSource };
export type MetadataMode = 'http' | 'sandbox';
