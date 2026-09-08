import {
  UtilityAdapter,
  UtilityExecutionContext,
  UtilityResourceLimits,
} from '../contracts/utility';
import {
  TextCleanerInput,
  TextCleanerOutput,
  CaseConverterInput,
  CaseConverterOutput,
  CaseConversionType,
} from '../contracts/mvp-utilities';

/**
 * 1. Text Cleaner Adapter (LOCAL)
 * Normalizes whitespace, lines, and formatting without altering semantic meaning.
 */
export class TextCleanerAdapter implements UtilityAdapter<TextCleanerInput, TextCleanerOutput> {
  readonly slug = 'text-cleaner';
  readonly name = 'Text Cleaner';
  readonly description = 'Clean, trim, and normalize whitespace, blank lines, and formatting in text';
  readonly version = '1.0.0';
  readonly mode = 'LOCAL';
  readonly resourceLimits: UtilityResourceLimits = {
    maxInputSizeBytes: 2 * 1024 * 1024, // 2MB
    maxExecutionTimeMs: 1000,
  };

  validateInput(input: unknown): TextCleanerInput {
    if (!input || typeof input !== 'object') {
      throw new Error('Input must be an object containing a "text" string');
    }
    const { text, options } = input as any;
    if (typeof text !== 'string') {
      throw new Error('Property "text" is required and must be a string');
    }
    if (text.length > (this.resourceLimits.maxInputSizeBytes || 2097152)) {
      throw new Error(`Text exceeds maximum allowed size of 2MB`);
    }

    return {
      text,
      options: {
        trimWhitespace: options?.trimWhitespace ?? true,
        collapseSpaces: options?.collapseSpaces ?? true,
        removeEmptyLines: options?.removeEmptyLines ?? true,
        normalizeLineEndings: options?.normalizeLineEndings ?? true,
        convertTabsToSpaces: options?.convertTabsToSpaces ?? false,
        tabSpaces: typeof options?.tabSpaces === 'number' ? Math.max(1, Math.min(8, options.tabSpaces)) : 2,
      },
    };
  }

  execute(input: TextCleanerInput, _context: UtilityExecutionContext): TextCleanerOutput {
    const raw = input.text;
    const opts = input.options || {};
    let result = raw;

    const initialLines = raw.split(/\r\n|\r|\n/).length;

    // 1. Normalize line endings to \n
    if (opts.normalizeLineEndings) {
      result = result.replace(/\r\n|\r/g, '\n');
    }

    // 2. Convert tabs to spaces if enabled
    if (opts.convertTabsToSpaces) {
      const spaceStr = ' '.repeat(opts.tabSpaces || 2);
      result = result.replace(/\t/g, spaceStr);
    }

    // 3. Process line by line
    let lines = result.split('\n');

    if (opts.trimWhitespace) {
      lines = lines.map((l) => l.trim());
    }

    if (opts.collapseSpaces) {
      lines = lines.map((l) => l.replace(/[^\S\r\n]+/g, ' '));
    }

    if (opts.removeEmptyLines) {
      lines = lines.filter((l) => l.length > 0);
    }

    result = lines.join('\n');

    if (opts.trimWhitespace) {
      result = result.trim();
    }

    const finalLines = lines.length;
    const linesRemoved = Math.max(0, initialLines - finalLines);
    const spacesCollapsed = Math.max(0, raw.length - result.length);

    return {
      cleanedText: result,
      originalCharCount: raw.length,
      cleanedCharCount: result.length,
      linesRemoved,
      spacesCollapsed,
    };
  }
}

/**
 * 2. Case Converter Adapter (LOCAL)
 * Deterministic conversion between uppercase, lowercase, title case, sentence case, camelCase, snake_case, and kebab-case.
 */
export class CaseConverterAdapter implements UtilityAdapter<CaseConverterInput, CaseConverterOutput> {
  readonly slug = 'case-converter';
  readonly name = 'Case Converter';
  readonly description = 'Convert text case: UPPERCASE, lowercase, Title Case, Sentence case, and code styles';
  readonly version = '1.0.0';
  readonly mode = 'LOCAL';
  readonly resourceLimits: UtilityResourceLimits = {
    maxInputSizeBytes: 2 * 1024 * 1024, // 2MB
    maxExecutionTimeMs: 1000,
  };

  validateInput(input: unknown): CaseConverterInput {
    if (!input || typeof input !== 'object') {
      throw new Error('Input must be an object with "text" and "targetCase"');
    }
    const { text, targetCase } = input as any;
    if (typeof text !== 'string') {
      throw new Error('Property "text" is required and must be a string');
    }

    const validCases: CaseConversionType[] = [
      'uppercase',
      'lowercase',
      'title',
      'sentence',
      'camel',
      'snake',
      'kebab',
    ];

    const selectedCase = (targetCase || 'uppercase').toLowerCase();
    if (!validCases.includes(selectedCase as CaseConversionType)) {
      throw new Error(`Invalid targetCase: "${targetCase}". Must be one of: ${validCases.join(', ')}`);
    }

    if (text.length > (this.resourceLimits.maxInputSizeBytes || 2097152)) {
      throw new Error(`Text exceeds maximum allowed limit of 2MB`);
    }

    return {
      text,
      targetCase: selectedCase as CaseConversionType,
    };
  }

  execute(input: CaseConverterInput, _context: UtilityExecutionContext): CaseConverterOutput {
    const raw = input.text;
    const targetCase = input.targetCase;

    let converted = '';

    switch (targetCase) {
      case 'uppercase':
        converted = raw.toUpperCase();
        break;

      case 'lowercase':
        converted = raw.toLowerCase();
        break;

      case 'title':
        converted = raw.replace(/\b\w+/g, (txt) => {
          return txt.charAt(0).toUpperCase() + txt.substring(1).toLowerCase();
        });
        break;

      case 'sentence':
        // Capitalize first letter of each sentence
        converted = raw
          .toLowerCase()
          .replace(/(^\s*\w|[.!?]\s+\w)/g, (c) => c.toUpperCase());
        break;

      case 'camel': {
        const words = raw
          .replace(/[^a-zA-Z0-9\s_-]/g, '')
          .split(/[\s_-]+/)
          .filter(Boolean);
        converted = words
          .map((w, idx) =>
            idx === 0
              ? w.toLowerCase()
              : w.charAt(0).toUpperCase() + w.substring(1).toLowerCase(),
          )
          .join('');
        break;
      }

      case 'snake': {
        converted = raw
          .trim()
          .replace(/([a-z])([A-Z])/g, '$1_$2')
          .replace(/[^a-zA-Z0-9]+/g, '_')
          .replace(/^_+|_+$/g, '')
          .toLowerCase();
        break;
      }

      case 'kebab': {
        converted = raw
          .trim()
          .replace(/([a-z])([A-Z])/g, '$1-$2')
          .replace(/[^a-zA-Z0-9]+/g, '-')
          .replace(/^-+|-+$/g, '')
          .toLowerCase();
        break;
      }

      default:
        converted = raw;
    }

    const words = converted.trim().split(/\s+/).filter(Boolean);

    return {
      convertedText: converted,
      caseType: targetCase,
      wordCount: words.length,
      characterCount: converted.length,
    };
  }
}
