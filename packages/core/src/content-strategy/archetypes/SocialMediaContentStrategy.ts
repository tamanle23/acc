import { UnifiedPipelineContext } from '@acc/core/pipeline';
import { BaseContentTaskStrategy, StrategyDescriptor } from '../BaseContentTaskStrategy';
import type { PipelineIR } from '@acc/ir';

export interface SocialMediaOutput {
  contentTypeId: string;
  pipelineId: string;
  targetModality: 'social';
  threadTweets: string[];
  linkedinPost: string;
  quoteCard: {
    headline: string;
    subheading: string;
    hashtags: string[];
    backgroundColor: string;
  };
  ir: PipelineIR;
  timestamp: number;
}

export class SocialMediaContentStrategy extends BaseContentTaskStrategy<any, SocialMediaOutput> {
  constructor(descriptor: StrategyDescriptor) {
    super({
      ...descriptor,
      targetModality: 'social',
    });
  }

  protected override async produceOutput(
    ctx: UnifiedPipelineContext<any>,
    ir: PipelineIR
  ): Promise<SocialMediaOutput> {
    const title = ir.metadata.title;
    const bodyText = ir.chunks[0]?.text || '';
    const tags = ir.metadata.tags || [];
    const hashtags = tags.map((t) => `#${t.replace(/[^a-zA-Z0-9]/g, '')}`).concat(['#ACC', '#ContentAI']);

    // Construct high-engagement Twitter/X thread
    const threadTweets = [
      `🚨 ${title}\n\n${bodyText.slice(0, 180)}... 🧵👇`,
      `Key Takeaway:\n${bodyText}\n\nWhat do you think? Drop your perspective below! 👇`,
      `Follow for automated daily updates on this topic! ${hashtags.join(' ')}`,
    ];

    // Construct professional LinkedIn post
    const linkedinPost = `📌 **${title}**\n\n${bodyText}\n\n💡 Insights & Analysis:\nAutomated via ACC Multi-Pipeline Engine.\n\n${hashtags.join(' ')}`;

    return {
      contentTypeId: this.contentTypeId,
      pipelineId: this.pipelineId,
      targetModality: 'social',
      threadTweets,
      linkedinPost,
      quoteCard: {
        headline: title,
        subheading: bodyText.slice(0, 100),
        hashtags,
        backgroundColor: '#1E293B',
      },
      ir,
      timestamp: Date.now(),
    };
  }
}
