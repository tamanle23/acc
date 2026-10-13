import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const getMock = vi.fn();
vi.mock('@/features/spring-auth', () => ({ springApiClient: { get: (...a: unknown[]) => getMock(...a) } }));

import { downloadTenantExport } from '../export-download';

type PickerWindow = { showSaveFilePicker?: unknown };

function streamOf(chunks: Uint8Array[]): ReadableStream<Uint8Array> {
  return new ReadableStream({
    start(controller) {
      chunks.forEach((c) => controller.enqueue(c));
      controller.close();
    },
  });
}

describe('downloadTenantExport', () => {
  beforeEach(() => {
    getMock.mockReset();
  });
  afterEach(() => {
    delete (window as unknown as PickerWindow).showSaveFilePicker;
  });

  it('streams chunks to disk via the /export-stream endpoint when File System Access API exists', async () => {
    const written: Uint8Array[] = [];
    const close = vi.fn().mockResolvedValue(undefined);
    (window as unknown as PickerWindow).showSaveFilePicker = vi.fn().mockResolvedValue({
      createWritable: async () => ({
        write: async (c: Uint8Array) => {
          written.push(c);
        },
        close,
        abort: vi.fn(),
      }),
    });
    getMock.mockResolvedValue({ data: streamOf([new Uint8Array([1, 2]), new Uint8Array([3])]) });

    const mode = await downloadTenantExport('acme');

    expect(mode).toBe('streamed-to-disk');
    expect(getMock.mock.calls[0][0]).toBe('/v1/metadata/tenants/acme/export-stream');
    expect(getMock.mock.calls[0][1]).toMatchObject({ responseType: 'stream', adapter: 'fetch' });
    expect(written).toHaveLength(2);
    expect(close).toHaveBeenCalledOnce();
  });

  it('aborts the writable and rethrows when the stream fails', async () => {
    const abort = vi.fn().mockResolvedValue(undefined);
    (window as unknown as PickerWindow).showSaveFilePicker = vi.fn().mockResolvedValue({
      createWritable: async () => ({ write: vi.fn(), close: vi.fn(), abort }),
    });
    getMock.mockRejectedValue(new Error('boom'));

    await expect(downloadTenantExport('acme')).rejects.toThrow('boom');
    expect(abort).toHaveBeenCalledOnce();
  });

  it('falls back to a buffered blob download without the File System Access API', async () => {
    getMock.mockResolvedValue({ data: new Blob(['zip']) });
    const createUrl = vi.fn().mockReturnValue('blob:x');
    window.URL.createObjectURL = createUrl;
    window.URL.revokeObjectURL = vi.fn();
    const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => undefined);

    const mode = await downloadTenantExport('acme');

    expect(mode).toBe('buffered');
    expect(getMock.mock.calls[0][1]).toMatchObject({ responseType: 'blob' });
    expect(createUrl).toHaveBeenCalledOnce();
    expect(click).toHaveBeenCalledOnce();
    click.mockRestore();
  });
});
