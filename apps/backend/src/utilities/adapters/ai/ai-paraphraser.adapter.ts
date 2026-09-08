import {
  UtilityAdapter,
  UtilityExecutionContext,
  UtilityResourceLimits,
  AiParaphraserInput,
  AiParaphraserOutput,
} from '@ad-utility/shared';
import { AiGatewayService } from '../../../ai/services/ai-gateway.service';

export class AiParaphraserAdapter implements UtilityAdapter<AiParaphraserInput, AiParaphraserOutput> {
  readonly slug = 'ai-paraphraser';
  readonly name = 'AI Paraphraser';
  readonly description = 'Rephrase and restructure sentences while keeping exact meaning and context';
  readonly version = '1.0.0';
  readonly mode = 'AI';
  readonly resourceLimits: UtilityResourceLimits = {
    maxInputSizeBytes: 50000,
    maxExecutionTimeMs: 30000,
  };

  constructor(private readonly aiGateway: AiGatewayService) {}

  validateInput(input: unknown): AiParaphraserInput {
    if (!input || typeof input !== 'object') {
      throw new Error('Input must be an object with "text"');
    }
    const { text, style } = input as any;
    if (typeof text !== 'string' || text.trim().length === 0) {
      throw new Error('Property "text" is required and cannot be empty');
    }

    if (text.length > (this.resourceLimits?.maxInputSizeBytes || 50000)) {
      throw new Error('Input text exceeds maximum limit of 50,000 characters');
    }

    const validStyles = ['standard', 'fluent', 'creative', 'concise'];
    const selectedStyle = style && validStyles.includes(style.toLowerCase()) ? style.toLowerCase() : 'standard';

    return {
      text: text.trim(),
      style: selectedStyle as any,
    };
  }

  async execute(input: AiParaphraserInput, context: UtilityExecutionContext): Promise<AiParaphraserOutput> {
    const styleDescription = {
      standard: 'clear, natural, and accurately balanced phrasing',
      fluent: 'exceptionally smooth, polished transitions and varied vocabulary',
      creative: 'vibrant, imaginative word choice and diverse syntactic structures',
      concise: 'tight, punchy, eliminating unnecessary filler words while retaining core meaning',
    }[input.style || 'standard'];

    const systemPrompt = `You are an expert writing assistant specializing in high-quality paraphrasing.
Rephrase the user's text in a ${styleDescription} style.
Preserve all key concepts, facts, and underlying intentions.
Do not add meta-commentary, introductory text, or explanatory footnotes. Output strictly the rephrased text.`;

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
      paraphrasedText: aiRes.result.trim(),
      originalWordCount: originalWords,
      resultWordCount: resultWords,
      style: input.style || 'standard',
      model: aiRes.model,
    };
  }
}
