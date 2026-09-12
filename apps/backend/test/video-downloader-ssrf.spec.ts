import * as dns from 'dns';
import { SsrProtectionService } from '../src/utilities/services/ssrf-protection.service';

describe('Phase 28 — Video Downloader SSRF & Security Protection Suite', () => {
  describe('1. IP Address Classification', () => {
    it('blocks IPv4 loopback (127.0.0.1, 127.0.1.1, 127.255.255.254)', () => {
      expect(SsrProtectionService.isPrivateOrInternalIp('127.0.0.1')).toBe(true);
      expect(SsrProtectionService.isPrivateOrInternalIp('127.0.1.1')).toBe(true);
      expect(SsrProtectionService.isPrivateOrInternalIp('127.255.255.254')).toBe(true);
    });

    it('blocks IPv4 RFC1918 private ranges (10.0.0.0/8, 172.16.0.0/12, 192.168.0.0/16)', () => {
      expect(SsrProtectionService.isPrivateOrInternalIp('10.0.0.1')).toBe(true);
      expect(SsrProtectionService.isPrivateOrInternalIp('10.254.254.254')).toBe(true);
      expect(SsrProtectionService.isPrivateOrInternalIp('172.16.0.1')).toBe(true);
      expect(SsrProtectionService.isPrivateOrInternalIp('172.31.255.255')).toBe(true);
      expect(SsrProtectionService.isPrivateOrInternalIp('192.168.1.1')).toBe(true);
      expect(SsrProtectionService.isPrivateOrInternalIp('192.168.254.254')).toBe(true);
    });

    it('blocks Cloud Metadata and Link-Local (169.254.169.254, 169.254.0.1)', () => {
      expect(SsrProtectionService.isPrivateOrInternalIp('169.254.169.254')).toBe(true);
      expect(SsrProtectionService.isPrivateOrInternalIp('169.254.1.1')).toBe(true);
    });

    it('blocks Carrier-Grade NAT (100.64.0.0/10) and Current Network (0.0.0.0/8)', () => {
      expect(SsrProtectionService.isPrivateOrInternalIp('0.0.0.0')).toBe(true);
      expect(SsrProtectionService.isPrivateOrInternalIp('0.1.2.3')).toBe(true);
      expect(SsrProtectionService.isPrivateOrInternalIp('100.64.0.1')).toBe(true);
      expect(SsrProtectionService.isPrivateOrInternalIp('100.127.255.255')).toBe(true);
    });

    it('blocks Multicast and Broadcast (224.0.0.1, 240.0.0.1, 255.255.255.255)', () => {
      expect(SsrProtectionService.isPrivateOrInternalIp('224.0.0.1')).toBe(true);
      expect(SsrProtectionService.isPrivateOrInternalIp('240.0.0.1')).toBe(true);
      expect(SsrProtectionService.isPrivateOrInternalIp('255.255.255.255')).toBe(true);
    });

    it('blocks IPv6 loopback (::1, 0:0:0:0:0:0:0:1) and unspecified (::)', () => {
      expect(SsrProtectionService.isPrivateOrInternalIp('::1')).toBe(true);
      expect(SsrProtectionService.isPrivateOrInternalIp('::')).toBe(true);
      expect(SsrProtectionService.isPrivateOrInternalIp('0:0:0:0:0:0:0:1')).toBe(true);
      expect(SsrProtectionService.isPrivateOrInternalIp('0:0:0:0:0:0:0:0')).toBe(true);
    });

    it('blocks IPv6 Unique Local (fc00::/7 - fc00:: and fd00::)', () => {
      expect(SsrProtectionService.isPrivateOrInternalIp('fc00::1')).toBe(true);
      expect(SsrProtectionService.isPrivateOrInternalIp('fd12:3456:789a::1')).toBe(true);
    });

    it('blocks IPv6 Link-Local (fe80::/10)', () => {
      expect(SsrProtectionService.isPrivateOrInternalIp('fe80::1')).toBe(true);
      expect(SsrProtectionService.isPrivateOrInternalIp('feb0::abcd')).toBe(true);
    });

    it('blocks IPv4-mapped IPv6 (::ffff:127.0.0.1, ::ffff:192.168.1.1, ::ffff:169.254.169.254)', () => {
      expect(SsrProtectionService.isPrivateOrInternalIp('::ffff:127.0.0.1')).toBe(true);
      expect(SsrProtectionService.isPrivateOrInternalIp('::ffff:192.168.1.1')).toBe(true);
      expect(SsrProtectionService.isPrivateOrInternalIp('::ffff:169.254.169.254')).toBe(true);
      expect(SsrProtectionService.isPrivateOrInternalIp('::ffff:10.0.0.1')).toBe(true);
    });

    it('allows valid public IPv4 and IPv6 addresses', () => {
      expect(SsrProtectionService.isPrivateOrInternalIp('8.8.8.8')).toBe(false);
      expect(SsrProtectionService.isPrivateOrInternalIp('1.1.1.1')).toBe(false);
      expect(SsrProtectionService.isPrivateOrInternalIp('93.184.216.34')).toBe(false);
      expect(SsrProtectionService.isPrivateOrInternalIp('2606:4700:4700::1111')).toBe(false);
      expect(SsrProtectionService.isPrivateOrInternalIp('2001:4860:4860::8888')).toBe(false);
    });
  });

  describe('2. URL & Hostname SSRF Validation', () => {
    it('rejects invalid or non-HTTP protocols', async () => {
      const ftp = await SsrProtectionService.validateUrl('ftp://example.com/video.mp4');
      expect(ftp.isValid).toBe(false);
      expect(ftp.errorCode).toBe('UNSUPPORTED_PROTOCOL');

      const file = await SsrProtectionService.validateUrl('file:///etc/passwd');
      expect(file.isValid).toBe(false);
      expect(file.errorCode).toBe('UNSUPPORTED_PROTOCOL');

      const gopher = await SsrProtectionService.validateUrl('gopher://127.0.0.1:70');
      expect(gopher.isValid).toBe(false);
      expect(gopher.errorCode).toBe('UNSUPPORTED_PROTOCOL');
    });

    it('rejects localhost hostnames', async () => {
      const res1 = await SsrProtectionService.validateUrl('http://localhost/video.mp4');
      expect(res1.isValid).toBe(false);
      expect(res1.errorCode).toBe('SSRF_BLOCKED');

      const res2 = await SsrProtectionService.validateUrl('http://sub.localhost:8080/video.mp4');
      expect(res2.isValid).toBe(false);
      expect(res2.errorCode).toBe('SSRF_BLOCKED');

      const res3 = await SsrProtectionService.validateUrl('http://server.local/video.mp4');
      expect(res3.isValid).toBe(false);
      expect(res3.errorCode).toBe('SSRF_BLOCKED');

      const res4 = await SsrProtectionService.validateUrl('http://internal.internal/video.mp4');
      expect(res4.isValid).toBe(false);
      expect(res4.errorCode).toBe('SSRF_BLOCKED');
    });

    it('rejects raw private IP literals directly in URL', async () => {
      const res1 = await SsrProtectionService.validateUrl('http://127.0.0.1:8000/video.mp4');
      expect(res1.isValid).toBe(false);
      expect(res1.errorCode).toBe('SSRF_BLOCKED');

      const res2 = await SsrProtectionService.validateUrl('http://169.254.169.254/latest/meta-data/');
      expect(res2.isValid).toBe(false);
      expect(res2.errorCode).toBe('SSRF_BLOCKED');

      const res3 = await SsrProtectionService.validateUrl('http://192.168.1.100/video.mp4');
      expect(res3.isValid).toBe(false);
      expect(res3.errorCode).toBe('SSRF_BLOCKED');
    });

    it('rejects if ANY resolved DNS record is a private IP (Dual-stack / Multi-A record protection)', async () => {
      // Mock dns lookup to return a mix of public and private addresses
      const lookupSpy = jest.spyOn(dns.promises, 'lookup').mockResolvedValueOnce([
        { address: '93.184.216.34', family: 4 },
        { address: '127.0.0.1', family: 4 }, // Dangerous secondary IP
      ] as any);

      const res = await SsrProtectionService.validateUrl('https://evil-dual-stack.example.com/video.mp4');
      expect(res.isValid).toBe(false);
      expect(res.errorCode).toBe('SSRF_BLOCKED');

      lookupSpy.mockRestore();
    });

    it('accepts fully verified public domains', async () => {
      const lookupSpy = jest.spyOn(dns.promises, 'lookup').mockResolvedValueOnce([
        { address: '93.184.216.34', family: 4 },
      ] as any);

      const res = await SsrProtectionService.validateUrl('https://example.com/video.mp4');
      expect(res.isValid).toBe(true);
      expect(res.normalizedUrl?.hostname).toBe('example.com');
      expect(res.resolvedIps).toContain('93.184.216.34');

      lookupSpy.mockRestore();
    });
  });
});
