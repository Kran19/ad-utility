import {
  UtilityAdapter,
  UtilityExecutionContext,
  UtilityResourceLimits,
} from '../contracts/utility';

/**
 * 1. Reference LOCAL Adapter: JSON Formatter
 */
export interface JsonFormatterInput {
  text: string;
  indent?: number;
}

export interface JsonFormatterOutput {
  formatted: string;
  lineCount: number;
  byteSize: number;
}

export class JsonFormatterAdapter implements UtilityAdapter<JsonFormatterInput, JsonFormatterOutput> {
  readonly slug = 'json-formatter';
  readonly name = 'JSON Formatter';
  readonly description = 'Format, prettify, and validate JSON data';
  readonly version = '1.0.0';
  readonly mode = 'LOCAL';
  readonly resourceLimits: UtilityResourceLimits = {
    maxInputSizeBytes: 5 * 1024 * 1024, // 5MB
    maxExecutionTimeMs: 1000,
  };

  validateInput(input: unknown): JsonFormatterInput {
    if (!input || typeof input !== 'object') {
      throw new Error('Input must be an object with a "text" string property');
    }
    const { text, indent } = input as any;
    if (typeof text !== 'string') {
      throw new Error('Property "text" is required and must be a string');
    }
    if (text.length === 0) {
      throw new Error('Input text cannot be empty');
    }
    if (text.length > (this.resourceLimits.maxInputSizeBytes || 5242880)) {
      throw new Error(`Input text exceeds maximum size of ${this.resourceLimits.maxInputSizeBytes} bytes`);
    }

    return {
      text,
      indent: typeof indent === 'number' ? Math.min(Math.max(indent, 1), 8) : 2,
    };
  }

  validateOutput(output: unknown): JsonFormatterOutput {
    if (!output || typeof output !== 'object') {
      throw new Error('Invalid output format');
    }
    const { formatted, lineCount, byteSize } = output as any;
    if (typeof formatted !== 'string' || typeof lineCount !== 'number' || typeof byteSize !== 'number') {
      throw new Error('Malformed JsonFormatter output');
    }
    return { formatted, lineCount, byteSize };
  }

  execute(input: JsonFormatterInput, _context: UtilityExecutionContext): JsonFormatterOutput {
    let parsed: any;
    try {
      parsed = JSON.parse(input.text);
    } catch (err: any) {
      throw new Error(`Invalid JSON syntax: ${err.message}`);
    }

    const formatted = JSON.stringify(parsed, null, input.indent || 2);
    const lineCount = formatted.split('\n').length;
    const byteSize = new TextEncoder().encode(formatted).length;

    return {
      formatted,
      lineCount,
      byteSize,
    };
  }
}

/**
 * 2. Reference LOCAL Adapter: Word Counter
 */
export interface WordCounterInput {
  text: string;
}

export interface WordCounterOutput {
  wordCount: number;
  charCount: number;
  charCountNoSpaces: number;
  lineCount: number;
  readingTimeMinutes: number;
}

export class WordCounterAdapter implements UtilityAdapter<WordCounterInput, WordCounterOutput> {
  readonly slug = 'word-counter';
  readonly name = 'Word Counter';
  readonly description = 'Count words, characters, sentences, and estimated reading time';
  readonly version = '1.0.0';
  readonly mode = 'LOCAL';
  readonly resourceLimits: UtilityResourceLimits = {
    maxInputSizeBytes: 2 * 1024 * 1024, // 2MB
    maxExecutionTimeMs: 500,
  };

  validateInput(input: unknown): WordCounterInput {
    if (!input || typeof input !== 'object') {
      throw new Error('Input must be an object with a "text" string');
    }
    const { text } = input as any;
    if (typeof text !== 'string') {
      throw new Error('Property "text" is required');
    }
    return { text };
  }

  execute(input: WordCounterInput, _context: UtilityExecutionContext): WordCounterOutput {
    const text = input.text.trim();
    if (!text) {
      return {
        wordCount: 0,
        charCount: 0,
        charCountNoSpaces: 0,
        lineCount: 0,
        readingTimeMinutes: 0,
      };
    }

    const words = text.split(/\s+/).filter(Boolean);
    const charCount = input.text.length;
    const charCountNoSpaces = input.text.replace(/\s+/g, '').length;
    const lineCount = input.text.split('\n').length;
    const readingTimeMinutes = Math.ceil(words.length / 200); // 200 wpm

    return {
      wordCount: words.length,
      charCount,
      charCountNoSpaces,
      lineCount,
      readingTimeMinutes,
    };
  }
}

/**
 * 3. Reference SERVER Adapter: Text Hash Generator
 */
export interface TextHashInput {
  text: string;
  algorithm?: 'sha256' | 'sha512';
}

export interface TextHashOutput {
  hash: string;
  algorithm: string;
  length: number;
}

export class TextHashAdapter implements UtilityAdapter<TextHashInput, TextHashOutput> {
  readonly slug = 'text-hash';
  readonly name = 'Text Hash Generator';
  readonly description = 'Compute cryptographic hashes on the server';
  readonly version = '1.0.0';
  readonly mode = 'SERVER';
  readonly resourceLimits: UtilityResourceLimits = {
    maxInputSizeBytes: 10 * 1024 * 1024, // 10MB
    maxExecutionTimeMs: 2000,
  };

  validateInput(input: unknown): TextHashInput {
    if (!input || typeof input !== 'object') {
      throw new Error('Input must be an object');
    }
    const { text, algorithm } = input as any;
    if (typeof text !== 'string') {
      throw new Error('Property "text" is required and must be a string');
    }
    const validAlgos = ['sha256', 'sha512'];
    const selectedAlgo = algorithm || 'sha256';
    if (!validAlgos.includes(selectedAlgo)) {
      throw new Error(`Unsupported hash algorithm: ${algorithm}`);
    }

    return {
      text,
      algorithm: selectedAlgo,
    };
  }

  async execute(input: TextHashInput, _context: UtilityExecutionContext): Promise<TextHashOutput> {
    const msgUint8 = new TextEncoder().encode(input.text);
    let hashHex = '';

    if (typeof globalThis !== 'undefined' && globalThis.crypto?.subtle) {
      const algoName = input.algorithm === 'sha512' ? 'SHA-512' : 'SHA-256';
      const hashBuffer = await globalThis.crypto.subtle.digest(algoName, msgUint8);
      const hashArray = Array.from(new Uint8Array(hashBuffer));
      hashHex = hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
    } else {
      hashHex = Array.from(msgUint8)
        .map((b) => b.toString(16).padStart(2, '0'))
        .join('');
    }

    return {
      hash: hashHex,
      algorithm: input.algorithm || 'sha256',
      length: hashHex.length,
    };
  }
}

/**
 * 4. Reference AI Adapter Interface Placeholder: AI Text Summarizer (No direct OpenAI execution)
 */
export interface AiSummarizerInput {
  text: string;
  targetLength?: 'short' | 'medium' | 'detailed';
}

export interface AiSummarizerOutput {
  summary: string;
  originalWordCount: number;
  summaryWordCount: number;
}

export class AiSummarizerPlaceholderAdapter implements UtilityAdapter<AiSummarizerInput, AiSummarizerOutput> {
  readonly slug = 'ai-summarizer';
  readonly name = 'AI Text Summarizer';
  readonly description = 'Summarize text documents using generative AI';
  readonly version = '1.0.0';
  readonly mode = 'AI';
  readonly resourceLimits: UtilityResourceLimits = {
    maxInputSizeBytes: 100 * 1024, // 100KB
    maxExecutionTimeMs: 15000,
  };

  validateInput(input: unknown): AiSummarizerInput {
    if (!input || typeof input !== 'object') {
      throw new Error('Input must be an object');
    }
    const { text, targetLength } = input as any;
    if (typeof text !== 'string' || text.trim().length === 0) {
      throw new Error('Property "text" is required and cannot be empty');
    }
    return {
      text,
      targetLength: targetLength || 'medium',
    };
  }

  execute(input: AiSummarizerInput, _context: UtilityExecutionContext): AiSummarizerOutput {
    const words = input.text.trim().split(/\s+/);
    const summary = `[AI Summary Preview for Phase 4]: Text contains ${words.length} words with key points summarized.`;
    return {
      summary,
      originalWordCount: words.length,
      summaryWordCount: summary.split(/\s+/).length,
    };
  }
}
