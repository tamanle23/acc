import { UniversalLogger as Logger } from '@acc/core-isomorphic';
import fs from 'fs';
import path from 'path';

export class FreesoundClient {
  private apiKey: string;
  private baseUrl = 'https://freesound.org/apiv2';

  constructor() {
    this.apiKey = process.env.FREESOUND_API_KEY || '';
  }

  public hasApiKey(): boolean {
    return this.apiKey.length > 0;
  }

  public async fetchSound(query: string, durationInSeconds: number, outputPath: string): Promise<string> {
    if (!this.hasApiKey()) {
      throw new Error('\x1b[31mFREESOUND_API_KEY is missing in .env file. Please get a free API key at https://freesound.org/apiv2/apply/\x1b[0m');
    }

    const minDur = Math.max(0, durationInSeconds - 2);
    const maxDur = durationInSeconds + 5; // Allow a bit of leeway

    const searchUrl = `${this.baseUrl}/search/text/?query=${encodeURIComponent(query)}&filter=duration:[${minDur} TO ${maxDur}]&sort=rating_desc&fields=id,name,previews&page_size=1`;
    
    Logger.info('FreesoundClient', `Searching: "${query}" (Target: ${durationInSeconds}s)`);
    
    const response = await fetch(searchUrl, {
      headers: {
        'Authorization': `Token ${this.apiKey}`
      }
    });

    if (!response.ok) {
      throw new Error(`Freesound API Error: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    
    if (!data.results || data.results.length === 0) {
      throw new Error(`No sounds found on Freesound for query: "${query}" with duration ~${durationInSeconds}s`);
    }

    const sound = data.results[0];
    const previewUrl = sound.previews['preview-hq-mp3'];

    if (!previewUrl) {
      throw new Error('Found sound but no HQ MP3 preview is available.');
    }

    Logger.info('FreesoundClient', `Downloading "${sound.name}" (ID: ${sound.id})`);
    
    // Download the MP3
    const audioRes = await fetch(previewUrl);
    if (!audioRes.ok) {
      throw new Error(`Failed to download audio file: ${audioRes.statusText}`);
    }

    const arrayBuffer = await audioRes.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // Make sure output path has .mp3 extension since freesound previews are mp3
    const parsedPath = path.parse(outputPath);
    const mp3OutputPath = path.join(parsedPath.dir, `${parsedPath.name}.mp3`);
    
    // ⚡ Bolt: Replaced synchronous fs.writeFileSync with async fs.promises.writeFile
    // 🎯 Why: Synchronous I/O blocks the Node.js event loop causing significant latency for other requests
    // 📊 Impact: Improves concurrency and unblocks the main thread.
    await fs.promises.writeFile(mp3OutputPath, buffer);
    return mp3OutputPath;
  }
}
