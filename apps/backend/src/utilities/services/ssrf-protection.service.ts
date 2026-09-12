import * as dns from 'dns';
import * as net from 'net';
import * as http from 'http';
import * as https from 'https';
import { URL } from 'url';

export interface SsrValidationResult {
  isValid: boolean;
  normalizedUrl?: URL;
  resolvedIps?: string[];
  errorCode?: string;
  errorMessage?: string;
}

export class SsrProtectionService {
  public static readonly MAX_REDIRECTS = 5;

  /**
   * Check if a given IPv4 or IPv6 string is private, loopback, link-local, or cloud metadata.
   */
  public static isPrivateOrInternalIp(ipStr: string): boolean {
    if (!ipStr) return true;

    // Handle IPv4-mapped IPv6 (e.g. ::ffff:127.0.0.1 or ::ffff:7f00:1)
    let ip = ipStr.trim().toLowerCase();
    if (ip.startsWith('::ffff:')) {
      const mapped = ip.substring(7);
      if (net.isIPv4(mapped)) {
        ip = mapped;
      }
    }

    // 1. IPv4 Checks
    if (net.isIPv4(ip)) {
      const parts = ip.split('.').map((p) => parseInt(p, 10));
      if (parts.length !== 4 || parts.some(isNaN)) return true;

      const [b0, b1] = parts;

      // 0.0.0.0/8 (Current network)
      if (b0 === 0) return true;

      // 10.0.0.0/8 (Private)
      if (b0 === 10) return true;

      // 127.0.0.0/8 (Loopback)
      if (b0 === 127) return true;

      // 100.64.0.0/10 (Carrier-grade NAT)
      if (b0 === 100 && b1 >= 64 && b1 <= 127) return true;

      // 169.254.0.0/16 (Link-Local & Cloud Metadata, e.g. AWS/GCP 169.254.169.254)
      if (b0 === 169 && b1 === 254) return true;

      // 172.16.0.0/12 (Private)
      if (b0 === 172 && b1 >= 16 && b1 <= 31) return true;

      // 192.0.0.0/24 (IETF Protocol Assignments)
      if (b0 === 192 && b1 === 0 && parts[2] === 0) return true;

      // 192.0.2.0/24 (TEST-NET-1)
      if (b0 === 192 && b1 === 0 && parts[2] === 2) return true;

      // 192.168.0.0/16 (Private)
      if (b0 === 192 && b1 === 168) return true;

      // 198.18.0.0/15 (Benchmarking)
      if (b0 === 198 && (b1 === 18 || b1 === 19)) return true;

      // 198.51.100.0/24 (TEST-NET-2)
      if (b0 === 198 && b1 === 51 && parts[2] === 100) return true;

      // 203.0.113.0/24 (TEST-NET-3)
      if (b0 === 203 && b1 === 0 && parts[2] === 113) return true;

      // 224.0.0.0/4 (Multicast)
      if (b0 >= 224 && b0 <= 239) return true;

      // 240.0.0.0/4 (Reserved / Broadcast)
      if (b0 >= 240) return true;

      // 255.255.255.255 (Broadcast)
      if (parts.every((p) => p === 255)) return true;

      return false;
    }

    // 2. IPv6 Checks
    if (net.isIPv6(ip)) {
      // Unspecified :: or ::0
      if (ip === '::' || ip === '::0' || ip === '0:0:0:0:0:0:0:0') return true;

      // Loopback ::1
      if (ip === '::1' || ip === '0:0:0:0:0:0:0:1') return true;

      // Unique Local Addresses (fc00::/7 - fc00:: through fdff::)
      if (ip.startsWith('fc') || ip.startsWith('fd')) return true;

      // Link-Local Unicast (fe80::/10 - fe80:: through febf::)
      if (ip.startsWith('fe8') || ip.startsWith('fe9') || ip.startsWith('fea') || ip.startsWith('feb')) return true;

      // Multicast (ff00::/8)
      if (ip.startsWith('ff')) return true;

      // Documentation (2001:db8::/32)
      if (ip.startsWith('2001:db8') || ip.startsWith('2001:0db8')) return true;

      return false;
    }

    return true;
  }

  /**
   * Validate a user-provided URL against SSRF rules:
   * 1. Protocol must be http: or https:
   * 2. Hostname must be present and not localhost/internal
   * 3. Resolves DNS to check all returned IP addresses
   */
  public static async validateUrl(rawUrl: string): Promise<SsrValidationResult> {
    if (!rawUrl || typeof rawUrl !== 'string') {
      return { isValid: false, errorCode: 'INVALID_URL', errorMessage: 'A valid URL is required.' };
    }

    let parsed: URL;
    try {
      parsed = new URL(rawUrl.trim());
    } catch {
      return { isValid: false, errorCode: 'INVALID_URL', errorMessage: 'Invalid URL format.' };
    }

    // 1. Protocol check
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
      return {
        isValid: false,
        errorCode: 'UNSUPPORTED_PROTOCOL',
        errorMessage: `Protocol "${parsed.protocol}" is not allowed. Only HTTP and HTTPS are supported.`,
      };
    }

    // 2. Hostname check
    const hostname = parsed.hostname.toLowerCase().replace(/\.+$/, '');
    if (!hostname) {
      return { isValid: false, errorCode: 'INVALID_URL', errorMessage: 'URL hostname is missing.' };
    }

    // Disallow obvious local hostnames
    if (
      hostname === 'localhost' ||
      hostname.endsWith('.localhost') ||
      hostname.endsWith('.local') ||
      hostname.endsWith('.internal')
    ) {
      return {
        isValid: false,
        errorCode: 'SSRF_BLOCKED',
        errorMessage: 'Requests to local or private hostnames are strictly blocked for security.',
      };
    }

    // 3. If hostname is already a raw IP literal
    if (net.isIP(hostname)) {
      if (this.isPrivateOrInternalIp(hostname)) {
        return {
          isValid: false,
          errorCode: 'SSRF_BLOCKED',
          errorMessage: 'Requests to private, loopback, or cloud metadata IP addresses are strictly blocked.',
        };
      }
      return { isValid: true, normalizedUrl: parsed, resolvedIps: [hostname] };
    }

    // 4. Resolve DNS (check all returned IPv4 and IPv6 addresses)
    try {
      const records = await dns.promises.lookup(hostname, { all: true });
      if (!records || records.length === 0) {
        return {
          isValid: false,
          errorCode: 'DNS_RESOLUTION_FAILED',
          errorMessage: `Unable to resolve DNS for host: ${hostname}`,
        };
      }

      const resolvedIps = records.map((r) => r.address);

      // Invariant: If ANY resolved IP is private/internal, reject the entire request
      for (const record of records) {
        if (this.isPrivateOrInternalIp(record.address)) {
          return {
            isValid: false,
            errorCode: 'SSRF_BLOCKED',
            errorMessage: 'Destination resolves to a private or internal network address. Request blocked.',
          };
        }
      }

      return {
        isValid: true,
        normalizedUrl: parsed,
        resolvedIps,
      };
    } catch (err: any) {
      return {
        isValid: false,
        errorCode: 'DNS_RESOLUTION_FAILED',
        errorMessage: `DNS lookup failed for ${hostname}: ${err.message}`,
      };
    }
  }

  /**
   * Create custom HTTP/HTTPS agent with pre-connection DNS lookup enforcement
   * preventing DNS rebinding during the actual socket connection.
   */
  public static createSecureAgent(isHttps: boolean) {
    const lookupFn = (
      hostname: string,
      options: dns.LookupOptions,
      callback: (err: NodeJS.ErrnoException | null, address: string | dns.LookupAddress[], family?: number) => void,
    ) => {
      dns.lookup(hostname, { all: true }, (err, addresses) => {
        if (err) {
          return callback(err, '');
        }
        if (!addresses || addresses.length === 0) {
          return callback(new Error('No DNS addresses found'), '');
        }

        // Validate all addresses
        for (const addr of addresses) {
          if (SsrProtectionService.isPrivateOrInternalIp(addr.address)) {
            const ssrfErr = new Error('DNS rebinding prevented: destination resolved to private IP');
            (ssrfErr as any).code = 'SSRF_BLOCKED';
            return callback(ssrfErr, '');
          }
        }

        // Safe: return the first resolved address
        if (options && options.all) {
          return callback(null, addresses);
        }
        return callback(null, addresses[0].address, addresses[0].family);
      });
    };

    if (isHttps) {
      return new https.Agent({
        lookup: lookupFn as any,
        keepAlive: false,
        timeout: 10000,
      });
    }

    return new http.Agent({
      lookup: lookupFn as any,
      keepAlive: false,
      timeout: 10000,
    });
  }
}
