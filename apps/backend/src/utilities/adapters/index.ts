import { UtilityRegistry, TextHashAdapter } from '@ad-utility/shared';
import { AiGatewayService } from '../../ai/services/ai-gateway.service';

// Image Adapters
import { JpgToPngAdapter } from './image/jpg-to-png.adapter';
import { PngToJpgAdapter } from './image/png-to-jpg.adapter';
import { ImageCompressorAdapter } from './image/image-compressor.adapter';
import { ImageToPdfAdapter } from './image/image-to-pdf.adapter';
import { ImageResizerAdapter } from './image/image-resizer.adapter';
import { ImageCropperAdapter } from './image/image-cropper.adapter';
import { WebpToJpgAdapter } from './image/webp-to-jpg.adapter';
import { JpgToWebpAdapter } from './image/jpg-to-webp.adapter';
import { PngToWebpAdapter } from './image/png-to-webp.adapter';

// PDF Adapters
import { PdfCompressorAdapter } from './pdf/pdf-compressor.adapter';
import { PdfMergeAdapter } from './pdf/pdf-merge.adapter';
import { PdfSplitAdapter } from './pdf/pdf-split.adapter';
import { PdfToJpgAdapter } from './pdf/pdf-to-jpg.adapter';
import { PdfToPngAdapter } from './pdf/pdf-to-png.adapter';
import { PdfToTextAdapter } from './pdf/pdf-to-text.adapter';
import { PdfPageExtractorAdapter } from './pdf/pdf-page-extractor.adapter';
import { PdfRotatorAdapter } from './pdf/pdf-rotator.adapter';
import { PdfReorderPagesAdapter } from './pdf/pdf-reorder-pages.adapter';
import { PdfWatermarkAdapter } from './pdf/pdf-watermark.adapter';
import { PdfMetadataRemoverAdapter } from './pdf/pdf-metadata-remover.adapter';

// Media Adapters (Video & Audio)
import { VideoCompressorAdapter } from './media/video-compressor.adapter';
import { Mp4ToMp3Adapter } from './media/mp4-to-mp3.adapter';
import { VideoToGifAdapter } from './media/video-to-gif.adapter';
import { VideoTrimmerAdapter } from './media/video-trimmer.adapter';
import { AudioCutterAdapter } from './media/audio-cutter.adapter';

// AI Adapters
import { AiHumanizerAdapter } from './ai/ai-humanizer.adapter';
import { AiParaphraserAdapter } from './ai/ai-paraphraser.adapter';
import { AiGrammarCheckerAdapter } from './ai/ai-grammar-checker.adapter';

export * from './image/jpg-to-png.adapter';
export * from './image/png-to-jpg.adapter';
export * from './image/image-compressor.adapter';
export * from './image/image-to-pdf.adapter';
export * from './image/image-resizer.adapter';
export * from './image/image-cropper.adapter';
export * from './image/webp-to-jpg.adapter';
export * from './image/jpg-to-webp.adapter';
export * from './image/png-to-webp.adapter';

export * from './pdf/pdf-compressor.adapter';
export * from './pdf/pdf-merge.adapter';
export * from './pdf/pdf-split.adapter';
export * from './pdf/pdf-to-jpg.adapter';
export * from './pdf/pdf-to-png.adapter';
export * from './pdf/pdf-to-text.adapter';
export * from './pdf/pdf-page-extractor.adapter';
export * from './pdf/pdf-rotator.adapter';
export * from './pdf/pdf-reorder-pages.adapter';
export * from './pdf/pdf-watermark.adapter';
export * from './pdf/pdf-metadata-remover.adapter';

import { VideoDownloaderAdapter } from './media/video-downloader.adapter';

export * from './media/video-compressor.adapter';
export * from './media/mp4-to-mp3.adapter';
export * from './media/video-to-gif.adapter';
export * from './media/video-trimmer.adapter';
export * from './media/audio-cutter.adapter';
export * from './media/video-downloader.adapter';

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
  if (!registry.has('image-to-pdf')) registry.register(new ImageToPdfAdapter());
  if (!registry.has('image-resizer')) registry.register(new ImageResizerAdapter());
  if (!registry.has('image-cropper')) registry.register(new ImageCropperAdapter());
  if (!registry.has('webp-to-jpg')) registry.register(new WebpToJpgAdapter());
  if (!registry.has('jpg-to-webp')) registry.register(new JpgToWebpAdapter());
  if (!registry.has('png-to-webp')) registry.register(new PngToWebpAdapter());

  // PDF
  if (!registry.has('pdf-compressor')) registry.register(new PdfCompressorAdapter());
  if (!registry.has('pdf-merge')) registry.register(new PdfMergeAdapter());
  if (!registry.has('pdf-split')) registry.register(new PdfSplitAdapter());
  if (!registry.has('pdf-to-jpg')) registry.register(new PdfToJpgAdapter());
  if (!registry.has('pdf-to-png')) registry.register(new PdfToPngAdapter());
  if (!registry.has('pdf-to-text')) registry.register(new PdfToTextAdapter());
  if (!registry.has('pdf-page-extractor')) registry.register(new PdfPageExtractorAdapter());
  if (!registry.has('pdf-rotator')) registry.register(new PdfRotatorAdapter());
  if (!registry.has('pdf-reorder-pages')) registry.register(new PdfReorderPagesAdapter());
  if (!registry.has('pdf-watermark')) registry.register(new PdfWatermarkAdapter());
  if (!registry.has('pdf-metadata-remover')) registry.register(new PdfMetadataRemoverAdapter());

  // Media (Video & Audio)
  if (!registry.has('video-compressor')) registry.register(new VideoCompressorAdapter());
  if (!registry.has('mp4-to-mp3')) registry.register(new Mp4ToMp3Adapter());
  if (!registry.has('video-to-gif')) registry.register(new VideoToGifAdapter());
  if (!registry.has('video-trimmer')) registry.register(new VideoTrimmerAdapter());
  if (!registry.has('audio-cutter')) registry.register(new AudioCutterAdapter());
  if (!registry.has('video-downloader')) registry.register(new VideoDownloaderAdapter());

  // Text & Developer
  if (!registry.has('text-hash')) registry.register(new TextHashAdapter());

  // AI
  if (!registry.has('ai-humanizer')) registry.register(new AiHumanizerAdapter(aiGateway));
  if (!registry.has('ai-paraphraser')) registry.register(new AiParaphraserAdapter(aiGateway));
  if (!registry.has('ai-grammar-checker')) registry.register(new AiGrammarCheckerAdapter(aiGateway));
}
