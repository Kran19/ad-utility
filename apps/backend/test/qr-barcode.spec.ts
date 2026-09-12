import { QrEngine, BarcodeEngine } from '@ad-utility/shared';

describe('Phase 27.1 — QR Code & Barcode Engine Verification', () => {
  describe('1. Standards-Compliant QR Code Generator & Decoder', () => {
    const testCases = [
      'https://google.com',
      'https://example.com',
      'https://utilityplatform.example/image-cropper',
      'https://example.com/?utm_source=test&utm_campaign=qr',
      'https://example.com/api?a=1&b=2&c=3#section-hero',
      'Simple plain text message for QR code',
      'mailto:support@adplatform.local?subject=Assistance',
      'tel:+15551234567',
      'WIFI:S:OfficeNetwork;T:WPA;P:SuperSecretPass2026;;',
    ];

    testCases.forEach((payload) => {
      it(`should encode and independently decode: "${payload.slice(0, 40)}..."`, () => {
        const qr = QrEngine.generate(payload, {
          errorCorrectionLevel: 'M',
          margin: 4,
        });

        expect(qr.size).toBeGreaterThan(21);
        expect(qr.moduleCount).toBeGreaterThanOrEqual(21);
        expect(qr.matrix.length).toBe(qr.size);
        expect(qr.svg).toContain('<svg');
        expect(qr.svg).toContain('</svg>');

        // Independently decode and verify exact string equality
        const decoded = QrEngine.decode(qr);
        expect(decoded).toBe(payload);
      });
    });

    it('should support all Error Correction Levels (L, M, Q, H)', () => {
      const url = 'https://example.com/reliability-test';
      const levels: Array<'L' | 'M' | 'Q' | 'H'> = ['L', 'M', 'Q', 'H'];

      levels.forEach((lvl) => {
        const qr = QrEngine.generate(url, { errorCorrectionLevel: lvl });
        expect(qr.errorCorrectionLevel).toBe(lvl);
        const decoded = QrEngine.decode(qr);
        expect(decoded).toBe(url);
      });
    });

    it('should correctly produce crisp SVG outputs with quiet zone', () => {
      const qr = QrEngine.generate('https://google.com', { margin: 4 });
      expect(qr.margin).toBe(4);
      expect(qr.svg).toContain('shape-rendering="crispEdges"');
      expect(qr.svg).toContain(`viewBox="0 0 ${qr.size} ${qr.size}"`);
    });
  });

  describe('2. Code 128 Barcode Generator & Decoder', () => {
    const barcodeCases = [
      '1234567890',
      'PROD-987654',
      'ITEM-A1B2C3D4',
      'SKU-2026-X',
    ];

    barcodeCases.forEach((text) => {
      it(`should generate and independently decode Code 128: "${text}"`, () => {
        const res = BarcodeEngine.generateCode128(text, 80, 10);

        expect(res.format).toBe('CODE128');
        expect(res.text).toBe(text);
        expect(res.modules.length).toBeGreaterThan(30);
        expect(res.svg).toContain('<svg');
        expect(res.svg).toContain(text);

        // Independently decode and verify checksum + framing
        const decoded = BarcodeEngine.decodeCode128(res);
        expect(decoded).toBe(text);
      });
    });

    it('should reject empty barcode text', () => {
      expect(() => BarcodeEngine.generateCode128('')).toThrow();
    });
  });
});
