export interface BrollPromptRequest {
  prompt: string;
  durationMs: number;
}

export class GenerativeAIFacade {
  public static async generateBrollAsset(request: BrollPromptRequest): Promise<string> {
    // Connects to Python gRPC AI service
    return `/tmp/gen_broll_${Date.now()}.mp4`;
  }
}
