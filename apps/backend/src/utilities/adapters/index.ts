import { UtilityRegistry } from '@ad-utility/shared';
import { AiGatewayService } from '../../ai/services/ai-gateway.service';

// Image Adapters
import { JpgToPngAdapter } from './image/jpg-to-png.adapter';
import { PngToJpgAdapter } from './image/png-to-jpg.adapter';
import { ImageCompressorAdapter } from './image/image-compressor.adapter';

// PDF Adapters
import { PdfCompressorAdapter } from './pdf/pdf-compressor.adapter';
import { PdfMergeAdapter } from './pdf/pdf-merge.adapter';
import { PdfSplitAdapter } from './pdf/pdf-split.adapter';
import { PdfToJpgAdapter } from './pdf/pdf-to-jpg.adapter';

// AI Adapters
import { AiHumanizerAdapter } from './ai/ai-humanizer.adapter';
import { AiParaphraserAdapter } from './ai/ai-paraphraser.adapter';
import { AiGrammarCheckerAdapter } from './ai/ai-grammar-checker.adapter';

export * from './image/jpg-to-png.adapter';
export * from './image/png-to-jpg.adapter';
export * from './image/image-compressor.adapter';

export * from './pdf/pdf-compressor.adapter';
export * from './pdf/pdf-merge.adapter';
export * from './pdf/pdf-split.adapter';
export * from './pdf/pdf-to-jpg.adapter';

export * from './ai/ai-humanizer.adapter';
export * from './ai/ai-paraphraser.adapter';
export * from './ai/ai-grammar-checker.adapter';

/**
 * Register all server-side and AI adapters into a UtilityRegistry instance
 */
export function registerServerAdapters(registry: UtilityRegistry, aiGateway: AiGatewayService): void {
  // Image
  if (!registry.has('jpg-to-png')) registry.register(new JpgToPngAdapter());
  if (!registry.has('png-to-jpg')) registry.register(new PngToJpgAdapter());
  if (!registry.has('image-compressor')) registry.register(new ImageCompressorAdapter());

  // PDF
  if (!registry.has('pdf-compressor')) registry.register(new PdfCompressorAdapter());
  if (!registry.has('pdf-merge')) registry.register(new PdfMergeAdapter());
  if (!registry.has('pdf-split')) registry.register(new PdfSplitAdapter());
  if (!registry.has('pdf-to-jpg')) registry.register(new PdfToJpgAdapter());

  // AI
  if (!registry.has('ai-humanizer')) registry.register(new AiHumanizerAdapter(aiGateway));
  if (!registry.has('ai-paraphraser')) registry.register(new AiParaphraserAdapter(aiGateway));
  if (!registry.has('ai-grammar-checker')) registry.register(new AiGrammarCheckerAdapter(aiGateway));
}
