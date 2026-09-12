# Video Downloader Utility (`video-downloader`)

## 1. Overview
The **Video Downloader** (`video-downloader`) is a production-hardened server utility that downloads and validates videos from verified direct HTTP/HTTPS media URLs (e.g., MP4, WebM, MOV, AVI, MKV).

The utility provides **zero DRM/anti-bot bypass**, strictly rejecting unsupported social media platforms and unauthorized sources (`UNSUPPORTED_SOURCE`), and enforces a strict defense-in-depth security perimeter against Server-Side Request Forgery (SSRF), DNS rebinding, payload inflation, and malicious container streams.

---

## 2. Architecture & Pipeline

```
                       User Input (Direct Video URL)
                                    │
                                    ▼
                         [VideoDownloaderAdapter]
                                    │
                                    ▼
                        [VideoUrlDownloadService]
                                    │
                     ┌──────────────┴──────────────┐
                     ▼                             ▼
           [Domain Whitelist Check]       [SSRF & IP Validation]
          (Rejects YouTube, IG, TikTok)   (IPv4/IPv6, Cloud Metadata)
                     │                             │
                     └──────────────┬──────────────┘
                                    │
                                    ▼
                         [DirectVideoProvider]
                                    │
                   ┌────────────────┴────────────────┐
                   ▼                                 ▼
         [Custom Secure Agent]            [Stream Download Engine]
        (Per-connection DNS Hook)        (Hard Byte Ceiling ≤ 50MB)
                   │                     (Max 5 Validated Redirects)
                   └────────────────┬────────────────┘
                                    │
                                    ▼
                          [Temporary File on Disk]
                                    │
                                    ▼
                         [Magic-Byte Inspection]
                     (ISO BMFF, EBML, AVI signatures)
                     (Rejects PE, ELF, Mach-O, HTML)
                                    │
                                    ▼
                         [FFprobe Media Isolation]
                     (Safe argument array, 15s timeout)
                     (Duration ≤ 30m, Resolution ≤ 4K)
                                    │
                                    ▼
                    [VideoDownloadStorageService]
                 (Token generation, 10m TTL cleanup)
                                    │
                                    ▼
            Download Endpoint: GET /api/v1/utilities/video-downloader/download/:token
```

---

## 3. Security Guardrails

### 3.1 Strict SSRF & DNS Rebinding Mitigation
- **IP Range Filtering**: Blocks private IPv4 (`10.0.0.0/8`, `172.16.0.0/12`, `192.168.0.0/16`), loopback (`127.0.0.0/8`), link-local/cloud metadata (`169.254.0.0/16`), CG-NAT (`100.64.0.0/10`), multicast/broadcast (`224.0.0.0/4`, `240.0.0.0/4`).
- **IPv6 Protection**: Blocks loopback (`::1`), unspecified (`::`), unique local (`fc00::/7`), link-local (`fe80::/10`), documentation prefixes, and IPv4-mapped IPv6 representations (`::ffff:127.0.0.1`).
- **Pre-Connection DNS Hook**: `SsrProtectionService.createSecureAgent` hooks into `lookup` during the actual socket handshake to ensure that if a host resolves to both public and private IPs, or alters DNS records between initial validation and connection, the connection is instantly aborted.
- **Redirects**: Max 5 redirect hops. Every intermediate redirect URL is re-validated through the full SSRF pipeline before the next HTTP request is dispatched.

### 3.2 Streaming Byte Ceiling (No Memory Base64 Ingestion)
- Remote `Content-Length` headers are checked upfront.
- An absolute hard byte counter is enforced during chunked stream consumption (`50MB` ceiling).
- Payloads are written directly to a secure temporary file on disk rather than loaded into RAM or serialized into `dataUrl` strings.

### 3.3 Binary File Signatures & Isolated FFprobe
- Inspects magic bytes (first 512 bytes):
  - ISO BMFF (`ftyp`, `moov`, `mdat`)
  - WebM / Matroska EBML header (`0x1A 0x45 0xDF 0xA3`)
  - AVI RIFF header (`RIFF....AVI `)
  - Rejects DOS/PE executables (`MZ`), ELF (`\x7fELF`), Mach-O (`\xfe\xed\xfa\xce`), and HTML/JavaScript files masquerading as video.
- Probes media container safely using `spawn('ffprobe', args, { shell: false })` with strict parameter arrays:
  - Validates stream count (≤ 16 streams)
  - Enforces max duration (≤ 1800 seconds / 30 minutes)
  - Enforces max dimensions (≤ 4096px / 4K)

### 3.4 Temporary Token & Streamable Download Endpoint
- Returned payload contains `downloadUrl`, `downloadToken`, `filename`, `sizeBytes`, `mimeType`, and `format`.
- The frontend triggers binary download via `GET /api/v1/utilities/video-downloader/download/:token`.
- Files are cleaned up after transmission and expired automatically via a background TTL sweep (10-minute lifetime).

---

## 4. Unsupported Platforms Policy
Attempting to pass URLs from YouTube, Instagram, TikTok, Facebook, Twitter/X, Vimeo, Dailymotion, Twitch, Reddit, or Pinterest immediately returns an `UNSUPPORTED_SOURCE` error response:
```json
{
  "success": false,
  "error": {
    "code": "UNSUPPORTED_SOURCE",
    "message": "Direct video downloading is not supported for youtube.com. This tool exclusively downloads authorized, direct video URLs (e.g. .mp4, .webm links)."
  }
}
```
No scraping, headless browsing, cookie theft, or anti-bot bypass mechanisms exist in the codebase.
