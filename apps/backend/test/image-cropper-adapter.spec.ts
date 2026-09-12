import { ImageCropperAdapter } from '../src/utilities/adapters/image/image-cropper.adapter';
import { PNG } from 'pngjs';
import * as jpeg from 'jpeg-js';

describe('ImageCropperAdapter Unit Verification', () => {
  let adapter: ImageCropperAdapter;

  const createTestPngBase64 = (width = 100, height = 100): string => {
    const png = new PNG({ width, height });
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const idx = (width * y + x) << 2;
        png.data[idx] = 120;
        png.data[idx + 1] = 180;
        png.data[idx + 2] = 240;
        png.data[idx + 3] = 255;
      }
    }
    const buf = PNG.sync.write(png);
    return `data:image/png;base64,${buf.toString('base64')}`;
  };

  beforeEach(() => {
    adapter = new ImageCropperAdapter();
  });

  it('should crop image with exact dimensions', async () => {
    const fileData = createTestPngBase64(200, 150);
    const input = adapter.validateInput({
      fileData,
      x: 20,
      y: 15,
      width: 100,
      height: 80,
      format: 'image/png',
    });

    const res = await adapter.execute(input, {} as any);
    expect(res.width).toBe(100);
    expect(res.height).toBe(80);
    expect(res.sizeBytes).toBeGreaterThan(0);
    expect(res.dataUrl).toContain('data:image/png;base64,');
  });

  it('should safely default to full image bounds when width and height are omitted or zero', async () => {
    const fileData = createTestPngBase64(160, 120);
    const input = adapter.validateInput({
      fileData,
      // No width or height passed
    });

    const res = await adapter.execute(input, {} as any);
    expect(res.width).toBe(160);
    expect(res.height).toBe(120);
  });

  it('should clamp out-of-bounds coordinates to image boundaries', async () => {
    const fileData = createTestPngBase64(100, 100);
    const input = adapter.validateInput({
      fileData,
      x: 70,
      y: 60,
      width: 200, // exceeds boundary
      height: 200, // exceeds boundary
    });

    const res = await adapter.execute(input, {} as any);
    expect(res.width).toBe(30); // 100 - 70 = 30
    expect(res.height).toBe(40); // 100 - 60 = 40
  });

  it('should rotate cropped image when rotation is requested', async () => {
    const fileData = createTestPngBase64(100, 100);
    const input = adapter.validateInput({
      fileData,
      x: 0,
      y: 0,
      width: 60,
      height: 40,
      rotateDegrees: 90,
    });

    const res = await adapter.execute(input, {} as any);
    expect(res.width).toBe(40);
    expect(res.height).toBe(60);
  });
});
