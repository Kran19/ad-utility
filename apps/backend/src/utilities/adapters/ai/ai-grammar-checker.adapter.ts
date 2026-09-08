import {
  UtilityAdapter,
  UtilityExecutionContext,
  UtilityResourceLimits,
  AiGrammarCheckerInput,
  AiGrammarCheckerOutput,
} from '@ad-utility/shared';
import { AiGatewayService } from '../../../ai/services/ai-gateway.service';

export class AiGrammarCheckerAdapter implements UtilityAdapter<AiGrammarCheckerInput, AiGrammarCheckerOutput> {
  readonly slug = 'ai-grammar-checker';
  readonly name = 'AI Grammar Checker';
  readonly description = 'Detect and correct grammatical mistakes, typos, and syntax errors';
  readonly version = '1.0.0';
  readonly mode = 'AI';
  readonly resourceLimits: UtilityResourceLimits = {
    maxInputSizeBytes: 50000,
    maxExecutionTimeMs: 30000,
  };

  constructor(private readonly aiGateway: AiGatewayService) {}

  validateInput(input: unknown): AiGrammarCheckerInput {
    if (!input || typeof input !== 'object') {
      throw new Error('Input must be an object with "text"');
    }
    const { text } = input as any;
    if (typeof text !== 'string' || text.trim().length === 0) {
      throw new Error('Property "text" is required and cannot be empty');
    }

    if (text.length > (this.resourceLimits?.maxInputSizeBytes || 50000)) {
      throw new Error('Input text exceeds maximum limit of 50,000 characters');
    }

    return {
      text: text.trim(),
    };
  }

  async execute(input: AiGrammarCheckerInput, context: UtilityExecutionContext): Promise<AiGrammarCheckerOutput> {
    const systemPrompt = `You are an expert grammar and copy-editing assistant.
Analyze the user's text for spelling errors, grammar mistakes, punctuation inaccuracies, and awkward phrasing.
You must return your response STRICTLY as a valid JSON object matching this schema:
{
  "correctedText": "Full text with all corrections applied",
  "issueCount": 0,
  "issues": [
    {
      "original": "error phrase",
      "correction": "corrected phrase",
      "type": "grammar" | "spelling" | "punctuation" | "style",
      "explanation": "Brief explanation of rule or fix"
    }
  ],
  "overallFeedback": "One or two sentences summarizing the overall quality and key improvements."
}
Return only the raw JSON string without markdown fencing or commentary.`;

    const aiRes = await this.aiGateway.generateText(
      {
        prompt: input.text,
        systemPrompt,
        utilitySlug: this.slug,
        sessionId: context.sessionToken,
      },
      context.ip,
    );

    let parsedResult: any;
    try {
      // Clean possible markdown code fences (```json ... ```)
      const cleanJson = aiRes.result.replace(/```json\s*|\s*```/g, '').trim();
      parsedResult = JSON.parse(cleanJson);
    } catch {
      // Fallback in case model or mock returned plain text
      parsedResult = {
        correctedText: aiRes.result.trim(),
        issueCount: 0,
        issues: [],
        overallFeedback: 'Analysis completed successfully.',
      };
    }

    return {
      correctedText: typeof parsedResult.correctedText === 'string' ? parsedResult.correctedText : aiRes.result.trim(),
      issueCount: typeof parsedResult.issueCount === 'number' ? parsedResult.issueCount : (parsedResult.issues?.length || 0),
      issues: Array.isArray(parsedResult.issues) ? parsedResult.issues : [],
      overallFeedback: parsedResult.overallFeedback || 'Text reviewed for grammar and style.',
      model: aiRes.model,
    };
  }
}
