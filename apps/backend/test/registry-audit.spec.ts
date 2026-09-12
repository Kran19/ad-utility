import { UtilityRegistry } from '@ad-utility/shared';
import { registerServerAdapters } from '../src/utilities/adapters';
import { DEFAULT_CATALOG_UTILITIES } from '../src/utilities/services/catalog-definitions';

describe('Hotfix Verification — Server Adapter Runtime Registration Audit', () => {
  let registry: UtilityRegistry;
  const mockAiGateway: any = {
    execute: jest.fn(),
  };

  beforeEach(() => {
    registry = new UtilityRegistry();
    registerServerAdapters(registry, mockAiGateway);
  });

  it('must resolve ImageCropperAdapter for slug "image-cropper"', () => {
    const adapter = registry.get('image-cropper');
    expect(adapter).toBeDefined();
    expect(adapter?.slug).toBe('image-cropper');
    expect(adapter?.name).toBe('Image Cropper');
    expect(adapter?.mode).toBe('SERVER');
  });

  it('must resolve all ACTIVE SERVER utilities in catalog to a valid adapter', () => {
    const serverUtils = DEFAULT_CATALOG_UTILITIES.filter(
      (u) => u.implementationMode === 'SERVER' && u.status === 'ACTIVE'
    );

    const missingAdapters: string[] = [];
    serverUtils.forEach((u) => {
      const adapter = registry.get(u.slug);
      if (!adapter) {
        missingAdapters.push(u.slug);
      } else {
        expect(adapter.slug).toBe(u.slug);
      }
    });

    expect(missingAdapters).toEqual([]);
  });

  it('must resolve all Image, PDF, and Media Phase 27 server adapters', () => {
    const expectedSlugs = [
      'image-to-pdf',
      'image-resizer',
      'image-cropper',
      'webp-to-jpg',
      'jpg-to-webp',
      'png-to-webp',
      'pdf-to-png',
      'pdf-to-text',
      'pdf-page-extractor',
      'pdf-rotator',
      'pdf-reorder-pages',
      'pdf-watermark',
      'pdf-metadata-remover',
      'video-compressor',
      'mp4-to-mp3',
      'video-to-gif',
      'video-trimmer',
      'audio-cutter',
    ];

    expectedSlugs.forEach((slug) => {
      const adapter = registry.get(slug);
      expect(adapter).toBeDefined();
      expect(adapter?.slug).toBe(slug);
    });
  });
});
