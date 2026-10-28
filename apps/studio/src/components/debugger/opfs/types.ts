import type {
  OpfsTreeNode,
  OpfsEntryInfo,
  OpfsStorageEstimate,
} from '@acc/core-web';
import type { CacheEntryMetadata } from '@acc/core-isomorphic';

export type OpfsViewMode = 'tree' | 'table';

export type OpfsFilterType = 'all' | 'media' | 'json' | 'meta' | 'other';

export type OpfsSortField = 'name' | 'size' | 'date';

export type OpfsSortDirection = 'asc' | 'desc';

export type OpfsModalTab = 'preview' | 'metadata' | 'hex';

export interface OpfsFileDetails {
  node: OpfsTreeNode | OpfsEntryInfo;
  blob: Blob | null;
  text: string | null;
  hexBytes: Uint8Array | null;
  companionMeta: CacheEntryMetadata | null;
  isLoading: boolean;
  error: string | null;
}

export interface OpfsActionState {
  isPurging: boolean;
  isRefreshing: boolean;
  isAddingTestFile: boolean;
  isDeleting: boolean;
}
