import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import * as cookieParser from 'cookie-parser';
import { AppModule } from '../src/app.module';
import { UtilitiesService } from '../src/utilities/utilities.service';

jest.setTimeout(45000);

describe('Phase 27 — Wave 3 Media Utilities Verification', () => {
  let app: INestApplication;
  let utilitiesService: UtilitiesService;

  beforeAll(async () => {
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
  });

  afterAll(async () => {
    await app.close();
  });

  describe('1. Input Validation and Security Guardrails', () => {
    it('video-compressor: rejects empty input', async () => {
      await expect(
        utilitiesService.executeUtility('video-compressor', {}),
      ).rejects.toThrow();
    });

    it('video-trimmer: rejects excessive trim duration (>180s)', async () => {
      await expect(
        utilitiesService.executeUtility('video-trimmer', {
          fileData: 'data:video/mp4;base64,AAAA',
          startTimeSec: 0,
          endTimeSec: 300,
        }),
      ).rejects.toThrow('Maximum supported trim duration is 3 minutes');
    });

    it('audio-cutter: rejects excessive audio cut duration (>600s)', async () => {
      await expect(
        utilitiesService.executeUtility('audio-cutter', {
          fileData: 'data:audio/mp3;base64,AAAA',
          startTimeSec: 0,
          endTimeSec: 1000,
        }),
      ).rejects.toThrow('Maximum supported audio cut duration is 10 minutes');
    });

    it('mp4-to-mp3: rejects empty payload', async () => {
      await expect(
        utilitiesService.executeUtility('mp4-to-mp3', { fileData: '' }),
      ).rejects.toThrow();
    });
  });
});
