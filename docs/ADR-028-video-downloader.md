# ADR 028: Video Downloader Architecture & SSRF Guardrails

## Status
Accepted / Implemented (Phase 28)

## Context
Video downloading from web URLs introduces significant security risks:
1. Server-Side Request Forgery (SSRF) and DNS rebinding attacks targeting loopback, internal VPC services, and cloud instance metadata (e.g. AWS/GCP `169.254.169.254`).
2. High memory pressure caused by base64-encoding large video files into in-memory JSON payloads.
3. Denial of Service (DoS) through slowloris streams, infinite redirect loops, or compressed payload bombs.
4. Legal, operational, and ethical liabilities from attempting to scrape or bypass anti-bot and DRM mechanisms of major social media networks (YouTube, TikTok, Instagram).

## Decisions

1. **Server-Side Temporary Binary Artifacts (No `dataUrl` Base64)**
   - Reject base64 strings for downloaded videos.
   - Stream directly to temporary disk storage and expose a dedicated streaming binary route: `GET /api/v1/utilities/video-downloader/download/:token`.
   - Implement `VideoDownloadStorageService` with a 10-minute TTL and automatic unreferenced background cleanup.

2. **Defense-in-Depth SSRF & DNS Rebinding Protection**
   - Perform static URL parsing, protocol validation (`http:`, `https:` only), and hostname checks.
   - Comprehensive IP classification rejecting RFC 1918, CG-NAT, link-local, cloud metadata, multicast, broadcast, IPv6 loopback/unique-local/link-local, and IPv4-mapped IPv6.
   - Enforce pre-connection DNS hook via custom HTTP/HTTPS agent `lookup` handler to guarantee the socket connection connects exclusively to verified public IPs.
   - Re-validate every redirect hop against the SSRF engine up to a maximum of 5 hops.

3. **Provider Pattern with Explicit Rejection of Scraping/DRM Platforms**
   - Define `VideoSourceProvider` with `DirectVideoProvider` as the standard implementation for direct media files.
   - Strictly reject third-party walled-garden and social media domains with clean `UNSUPPORTED_SOURCE` error codes.

4. **Stream Validation and Isolated Media Probing**
   - Reject non-matching magic bytes before processing (supports ISO BMFF MP4, WebM EBML, QuickTime MOV, AVI, MKV).
   - Reject executable binaries (PE, ELF, Mach-O) and HTML masquerading as video.
   - Run `ffprobe` in an isolated child process using safe parameter arrays (no shell execution) with a 15-second timeout, stream count limits (≤ 16), max duration (≤ 30 min), and max dimension (≤ 4K).

5. **Privacy & Analytics Sanitation**
   - Telemetry and analytics log only the parsed domain name, stripping all query parameters, tokens, and authorization credentials.

## Consequences
- The platform safely supports direct video downloads with optimal memory footprint.
- Internal infrastructure and metadata endpoints are protected against SSRF and DNS rebinding.
- Clear user expectations are set regarding supported direct media URLs versus third-party walled gardens.
