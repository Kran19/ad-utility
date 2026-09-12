import * as http from 'http';
import * as net from 'net';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import * as cookieParser from 'cookie-parser';
import * as request from 'supertest';
import { AppModule } from '../src/app.module';
import { UtilitiesService } from '../src/utilities/utilities.service';
import { SsrProtectionService } from '../src/utilities/services/ssrf-protection.service';
import { VideoDownloadStorageService } from '../src/utilities/services/video-downloader/video-storage.service';
import { VideoDownloaderErrorCode } from '@ad-utility/shared';

jest.setTimeout(45000);

describe('Phase 28 — Video Downloader End-to-End & Controlled HTTP Server Suite', () => {
  let app: INestApplication;
  let utilitiesService: UtilitiesService;
  let testServer: http.Server;
  let testServerPort: number;
  let testServerBaseUrl: string;

  // Minimal valid MP4 header buffer (ISO BMFF with 'ftyp' box)
  const validMp4Buffer = Buffer.concat([
    Buffer.from([0x00, 0x00, 0x00, 0x18]), // box size: 24
    Buffer.from('ftypmp42', 'ascii'),     // box type & major brand
    Buffer.from([0x00, 0x00, 0x00, 0x00]), // minor version
    Buffer.from('mp42isom', 'ascii'),     // compatible brands
    Buffer.from([0x00, 0x00, 0x00, 0x08]), // mdat box size
    Buffer.from('mdat', 'ascii'),         // media data box
    Buffer.alloc(2048, 0xaa),             // Dummy video payload
  ]);

  // Minimal valid WebM buffer (EBML ID 0x1A 0x45 0xDF 0xA3 + 'webm' doctype)
  const validWebmBuffer = Buffer.concat([
    Buffer.from([0x1a, 0x45, 0xdf, 0xa3, 0x9f, 0x42, 0x86, 0x81, 0x01, 0x42, 0xf7, 0x81, 0x01, 0x42, 0xf2, 0x81, 0x04, 0x42, 0xf3, 0x81, 0x08, 0x42, 0x82, 0x84]),
    Buffer.from('webm', 'ascii'),
    Buffer.alloc(1024, 0xbb),
  ]);

  beforeAll(async () => {
    // 1. Start Nest App
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.use(cookieParser());
    app.setGlobalPrefix('api/v1');
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      }),
    );
    await app.init();
    utilitiesService = moduleFixture.get<UtilitiesService>(UtilitiesService);

    // 2. Start Controlled Local Test HTTP Server
    testServer = http.createServer((req, res) => {
      const url = req.url || '';

      if (url === '/video.mp4') {
        res.writeHead(200, {
          'Content-Type': 'video/mp4',
          'Content-Length': validMp4Buffer.length,
          'Content-Disposition': 'attachment; filename="test_video.mp4"',
        });
        res.end(validMp4Buffer);
      } else if (url === '/video.webm') {
        res.writeHead(200, {
          'Content-Type': 'video/webm',
          'Content-Length': validWebmBuffer.length,
        });
        res.end(validWebmBuffer);
      } else if (url === '/large-video') {
        // Declared Content-Length > 50MB limit
        res.writeHead(200, {
          'Content-Type': 'video/mp4',
          'Content-Length': 60 * 1024 * 1024,
        });
        res.end('too-large');
      } else if (url === '/no-content-length') {
        res.writeHead(200, {
          'Content-Type': 'video/mp4',
          'Transfer-Encoding': 'chunked',
        });
        res.write(validMp4Buffer);
        res.end();
      } else if (url === '/redirect-step1') {
        res.writeHead(302, { Location: '/redirect-step2' });
        res.end();
      } else if (url === '/redirect-step2') {
        res.writeHead(302, { Location: '/video.mp4' });
        res.end();
      } else if (url === '/redirect-loop') {
        res.writeHead(302, { Location: '/redirect-loop' });
        res.end();
      } else if (url === '/redirect-private') {
        res.writeHead(302, { Location: 'http://127.0.0.1:9999/internal-data' });
        res.end();
      } else if (url === '/html-disguised') {
        res.writeHead(200, { 'Content-Type': 'video/mp4' });
        res.end('<!DOCTYPE html><html><body><h1>Fake Video</h1><script>alert(1)</script></body></html>');
      } else if (url === '/not-found') {
        res.writeHead(404, { 'Content-Type': 'text/plain' });
        res.end('Not Found');
      } else if (url === '/forbidden') {
        res.writeHead(403, { 'Content-Type': 'text/plain' });
        res.end('Forbidden');
      } else {
        res.writeHead(404);
        res.end();
      }
    });

    await new Promise<void>((resolve) => {
      testServer.listen(0, '127.0.0.1', () => {
        const addr = testServer.address() as net.AddressInfo;
        testServerPort = addr.port;
        testServerBaseUrl = `http://127.0.0.1:${testServerPort}`;
        resolve();
      });
    });
  });

  afterAll(async () => {
    if (testServer) {
      await new Promise<void>((resolve) => testServer.close(() => resolve()));
    }
    await app.close();
  });

  describe('1. Unsupported Platforms and DRM Guardrails', () => {
    it('rejects DRM and subscription paywall URLs with UNSUPPORTED_SOURCE', async () => {
      await expect(
        utilitiesService.executeUtility('video-downloader', {
          url: 'https://www.netflix.com/watch/12345678',
        }),
      ).rejects.toThrow('Direct video downloading is not supported for www.netflix.com');
    });

    it('rejects Spotify media URLs with UNSUPPORTED_SOURCE', async () => {
      await expect(
        utilitiesService.executeUtility('video-downloader', {
          url: 'https://open.spotify.com/track/1234567890',
        }),
      ).rejects.toThrow('Direct video downloading is not supported for open.spotify.com');
    });
  });

  describe('2. Controlled Local Test Server Flow (With Controlled Test Harness)', () => {
    let originalIsPrivate: typeof SsrProtectionService.isPrivateOrInternalIp;

    beforeEach(() => {
      originalIsPrivate = SsrProtectionService.isPrivateOrInternalIp;
      // In the test harness, allow the specific testServerPort on 127.0.0.1 to simulate remote HTTP servers
      jest.spyOn(SsrProtectionService, 'isPrivateOrInternalIp').mockImplementation((ip) => {
        if (ip === '127.0.0.1' || ip === '::1') {
          // Allow loopback strictly for our test harness
          return false;
        }
        return originalIsPrivate(ip);
      });
    });

    afterEach(() => {
      jest.restoreAllMocks();
    });

    it('successfully downloads and verifies MP4 stream from URL', async () => {
      const result: any = await utilitiesService.executeUtility('video-downloader', {
        url: `${testServerBaseUrl}/video.mp4`,
      });

      expect(result.result).toBeDefined();
      expect(result.result.filename).toContain('test_video');
      expect(result.result.format).toBe('mp4');
      expect(result.result.mimeType).toBe('video/mp4');
      expect(result.result.sizeBytes).toBe(validMp4Buffer.length);
      expect(result.result.downloadToken).toBeDefined();
      expect(result.result.downloadUrl).toContain('/api/v1/utilities/video-downloader/download/');
    });

    it('successfully downloads and verifies WebM stream from URL', async () => {
      const result: any = await utilitiesService.executeUtility('video-downloader', {
        url: `${testServerBaseUrl}/video.webm`,
      });

      expect(result.result).toBeDefined();
      expect(result.result.format).toBe('webm');
      expect(result.result.mimeType).toBe('video/webm');
      expect(result.result.sizeBytes).toBe(validWebmBuffer.length);
    });

    it('handles HTTP chunked transfer without Content-Length header', async () => {
      const result: any = await utilitiesService.executeUtility('video-downloader', {
        url: `${testServerBaseUrl}/no-content-length`,
      });

      expect(result.result).toBeDefined();
      expect(result.result.format).toBe('mp4');
      expect(result.result.sizeBytes).toBe(validMp4Buffer.length);
    });

    it('follows safe HTTP redirects (302) to destination video', async () => {
      const result: any = await utilitiesService.executeUtility('video-downloader', {
        url: `${testServerBaseUrl}/redirect-step1`,
      });

      expect(result.result).toBeDefined();
      expect(result.result.format).toBe('mp4');
    });

    it('rejects files exceeding size limit (>50MB declared)', async () => {
      await expect(
        utilitiesService.executeUtility('video-downloader', {
          url: `${testServerBaseUrl}/large-video`,
        }),
      ).rejects.toThrow('exceeds the maximum allowed limit');
    });

    it('rejects HTML/scripts disguised with video Content-Type via magic byte inspection', async () => {
      await expect(
        utilitiesService.executeUtility('video-downloader', {
          url: `${testServerBaseUrl}/html-disguised`,
        }),
      ).rejects.toThrow('HTML/webpage detected instead of binary video');
    });

    it('handles remote 404 Not Found cleanly', async () => {
      await expect(
        utilitiesService.executeUtility('video-downloader', {
          url: `${testServerBaseUrl}/not-found`,
        }),
      ).rejects.toThrow('Video not found on remote server (404)');
    });

    it('handles remote 403 Forbidden cleanly', async () => {
      await expect(
        utilitiesService.executeUtility('video-downloader', {
          url: `${testServerBaseUrl}/forbidden`,
        }),
      ).rejects.toThrow('Access to video is forbidden by remote server');
    });
  });

  describe('3. Binary Streaming Download Endpoint & TTL Cleanup', () => {
    it('streams binary file via GET /api/v1/utilities/video-downloader/download/:token', async () => {
      const storage = VideoDownloadStorageService.getInstance();
      const tempPath = path.join(os.tmpdir(), `test_artifact_${Date.now()}.mp4`);
      fs.writeFileSync(tempPath, validMp4Buffer);

      const token = storage.registerArtifact({
        filePath: tempPath,
        filename: 'my_downloaded_video.mp4',
        mimeType: 'video/mp4',
        sizeBytes: validMp4Buffer.length,
      });

      const response = await request(app.getHttpServer())
        .get(`/api/v1/utilities/video-downloader/download/${token}`)
        .expect(200);

      expect(response.headers['content-type']).toBe('video/mp4');
      expect(response.headers['content-length']).toBe(validMp4Buffer.length.toString());
      expect(response.headers['content-disposition']).toContain('my_downloaded_video.mp4');
      expect(response.body).toBeInstanceOf(Buffer);
    });

    it('returns 404 for invalid or expired download tokens', async () => {
      await request(app.getHttpServer())
        .get('/api/v1/utilities/video-downloader/download/invalid_or_expired_token')
        .expect(404);
    });
  });
});
