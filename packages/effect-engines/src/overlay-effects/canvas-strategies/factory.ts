import { CanvasAdapter } from './base';
import { NapiRsCanvasAdapter } from './napi-rs';

export class CanvasAdapterFactory {
  static getAdapter(engine: string = 'napi-rs'): CanvasAdapter {
    if (engine === 'napi-rs') {
      return new NapiRsCanvasAdapter();
    } else {
      throw new Error(`Canvas engine ${engine} not supported yet.`);
    }
  }
}
