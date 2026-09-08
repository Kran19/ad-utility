import {
  UtilityAdapter,
  UtilityExecutionContext,
  UtilityResourceLimits,
  AiHumanizerInput,
  AiHumanizerOutput,
} from '@ad-utility/shared';
import { AiGatewayService } from '../../../ai/services/ai-gateway.service';

export class AiHumanizerAdapter implements UtilityAdapter<AiHumanizerInput, AiHumanizerOutput> {
  readonly slug = 'ai-humanizer';
  readonly name = 'AI Humanizer';
  readonly description = 'Refine and polish AI-generated drafts into natural, human-flowing text';
  readonly version = '1.0.0';
  readonly mode = 'AI';
  readonly resourceLimits: UtilityResourceLimits = {
    maxInputSizeBytes: 50000, // 50,000 characters
    maxExecutionTimeMs: 30000,
  };

  constructor(private readonly aiGateway: AiGatewayService) {}

  validateInput(input: unknown): AiHumanizerInput {
    if (!input || typeof input !== 'object') {
      throw new Error('Input must be an object with "text"');
    }
    const { text, tone } = input as any;
    if (typeof text !== 'string' || text.trim().length === 0) {
      throw new Error('Property "text" is required and cannot be empty');
    }

    if (text.length > (this.resourceLimits?.maxInputSizeBytes || 50000)) {
      throw new Error('Input text exceeds maximum limit of 50,000 characters');
    }

    const validTones = ['standard', 'formal', 'casual', 'academic', 'creative'];
    const selectedTone = tone && validTones.includes(tone.toLowerCase()) ? tone.toLowerCase() : 'standard';

    return {
      text: text.trim(),
      tone: selectedTone as any,
    };
  }

  async execute(input: AiHumanizerInput, context: UtilityExecutionContext): Promise<AiHumanizerOutput> {
    const toneDescription = {
      standard: 'balanced, clear, natural, and engaging',
      formal: 'professional, polished, articulate, and authoritative',
      casual: 'conversational, warm, relatable, and approachable',
      academic: 'rigorous, precise, analytical, and scholarly',
      creative: 'vivid, expressive, varied in sentence structure, and dynamic',
    }[input.tone || 'standard'];

    const systemPrompt = `You are an expert editor specializing in refining written content to sound natural, fluent, and human.
Your goal is to improve readability, rhythm, and flow in a ${toneDescription} tone.
Preserve all factual accuracy, specific details, arguments, and intent from the original text.
Do not insert meta-commentary, introductory remarks (such as "Here is the humanized version:"), or closing notes. Return only the refined text.`;

    const aiRes = await this.aiGateway.generateText(
      {
        prompt: input.text,
        systemPrompt,
        utilitySlug: this.slug,
        sessionId: context.sessionToken,
      },
      context.ip,
    );

    const originalWords = input.text.split(/\s+/).filter(Boolean).length;
    const resultWords = aiRes.result.split(/\s+/).filter(Boolean).length;

    return {
      humanizedText: aiRes.result.trim(),
      originalWordCount: originalWords,
      resultWordCount: resultWords,
      tone: input.tone || 'standard',
      model: aiRes.model,
    };
  }
}
