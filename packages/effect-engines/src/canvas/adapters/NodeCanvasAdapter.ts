import { NapiCanvasAdapter } from '@acc/core-native';

export class NodeCanvasAdapter extends NapiCanvasAdapter {
  public override readonly name = 'node-napi-rs';
}
