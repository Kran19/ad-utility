#!/usr/bin/env bash
# ============================================================
# Phase 13 Launch Smoke Test Script (POSIX/Bash)
# ============================================================
set -eo pipefail

FRONTEND_URL="${1:-http://localhost:3001}"
BACKEND_URL="${2:-http://localhost:4001}"

PASSED=0
FAILED=0

echo "============================================================"
echo " STARTING PLATFORM LAUNCH SMOKE TESTS"
echo " Frontend: ${FRONTEND_URL}"
echo " Backend:  ${BACKEND_URL}"
echo "============================================================"

check_test() {
  local name="$1"
  local status="$2"
  local details="$3"

  if [ "$status" -eq 0 ]; then
    PASSED=$((PASSED + 1))
    echo "  [PASS] ${name} - ${details}"
  else
    FAILED=$((FAILED + 1))
    echo "  [FAIL] ${name} - ${details}"
  fi
}

echo ""
echo "1. Observability & Health Probes..."

# 1. Health
HEALTH_RES=$(curl -s -f "${BACKEND_URL}/api/v1/health" || true)
if echo "$HEALTH_RES" | grep -q '"status":"ok"'; then
  check_test "GET /api/v1/health" 0 "Service OK"
else
  check_test "GET /api/v1/health" 1 "Invalid response: ${HEALTH_RES}"
fi

# 2. Liveness
LIVENESS_RES=$(curl -s -f "${BACKEND_URL}/api/v1/health/liveness" || true)
if echo "$LIVENESS_RES" | grep -q '"status":"alive"'; then
  check_test "GET /api/v1/health/liveness" 0 "Status Alive"
else
  check_test "GET /api/v1/health/liveness" 1 "Liveness failed: ${LIVENESS_RES}"
fi

# 3. Readiness
READINESS_RES=$(curl -s -f "${BACKEND_URL}/api/v1/health/readiness" || true)
if echo "$READINESS_RES" | grep -q '"status":"ready"'; then
  check_test "GET /api/v1/health/readiness" 0 "Database Connected"
else
  check_test "GET /api/v1/health/readiness" 1 "Readiness failed: ${READINESS_RES}"
fi

echo ""
echo "2. Public Frontend & SEO Routes..."

# 4. Homepage
HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" "${FRONTEND_URL}/" || true)
if [ "$HTTP_CODE" -eq 200 ]; then
  check_test "GET / (Homepage)" 0 "HTTP 200 OK"
else
  check_test "GET / (Homepage)" 1 "HTTP ${HTTP_CODE}"
fi

# 5. Robots
ROBOTS_TXT=$(curl -s -f "${FRONTEND_URL}/robots.txt" || true)
if echo "$ROBOTS_TXT" | grep -q "User-agent"; then
  check_test "GET /robots.txt" 0 "Robots directives present"
else
  check_test "GET /robots.txt" 1 "Robots missing User-agent"
fi

# 6. Sitemap
SITEMAP_XML=$(curl -s -f "${FRONTEND_URL}/sitemap.xml" || true)
if echo "$SITEMAP_XML" | grep -q "<urlset"; then
  check_test "GET /sitemap.xml" 0 "Valid XML sitemap"
else
  check_test "GET /sitemap.xml" 1 "Sitemap missing urlset"
fi

# 7. Category Route
CAT_CODE=$(curl -s -o /dev/null -w "%{http_code}" "${FRONTEND_URL}/category/image" || true)
if [ "$CAT_CODE" -eq 200 ]; then
  check_test "GET /category/image" 0 "HTTP 200 OK"
else
  check_test "GET /category/image" 1 "HTTP ${CAT_CODE}"
fi

# 8. Tool Route
TOOL_CODE=$(curl -s -o /dev/null -w "%{http_code}" "${FRONTEND_URL}/case-converter" || true)
if [ "$TOOL_CODE" -eq 200 ]; then
  check_test "GET /case-converter" 0 "HTTP 200 OK"
else
  check_test "GET /case-converter" 1 "HTTP ${TOOL_CODE}"
fi

echo ""
echo "3. Security & Access Boundaries..."

# 9. Admin unauth
UNAUTH_CODE=$(curl -s -o /dev/null -w "%{http_code}" "${BACKEND_URL}/api/v1/admin/users" || true)
if [ "$UNAUTH_CODE" -eq 401 ]; then
  check_test "GET /api/v1/admin/users without token" 0 "HTTP 401 Unauthorized enforced"
else
  check_test "GET /api/v1/admin/users without token" 1 "Expected 401, got ${UNAUTH_CODE}"
fi

UNAUTH_ADS_CODE=$(curl -s -o /dev/null -w "%{http_code}" "${BACKEND_URL}/api/v1/admin/ads/campaigns" || true)
if [ "$UNAUTH_ADS_CODE" -eq 401 ]; then
  check_test "GET /api/v1/admin/ads/campaigns without token" 0 "HTTP 401 Unauthorized enforced"
else
  check_test "GET /api/v1/admin/ads/campaigns without token" 1 "Expected 401, got ${UNAUTH_ADS_CODE}"
fi

echo ""
echo "4. Representative Utility Execution..."

# 10. Utility Metadata
META_RES=$(curl -s -f "${BACKEND_URL}/api/v1/utilities/case-converter" || true)
if echo "$META_RES" | grep -q '"slug":"case-converter"'; then
  check_test "GET /api/v1/utilities/case-converter (Public Metadata)" 0 "Tool metadata resolved"
else
  check_test "GET /api/v1/utilities/case-converter (Public Metadata)" 1 "Metadata failed: ${META_RES}"
fi

# 11. Utility Execution (AI Mock)
UTIL_RES=$(curl -s -X POST -H "Content-Type: application/json" \
  -d '{"input":{"text":"Phase 13 production launch readiness verified."}}' \
  "${BACKEND_URL}/api/v1/utilities/ai-paraphraser/execute" || true)
if echo "$UTIL_RES" | grep -q '"requestId"'; then
  check_test "POST /api/v1/utilities/ai-paraphraser/execute (Offline AI)" 0 "Execution output & requestId verified"
else
  check_test "POST /api/v1/utilities/ai-paraphraser/execute (Offline AI)" 1 "Execution failed: ${UTIL_RES}"
fi

echo ""
echo "5. Monetization & Ad Engine..."

# 11. Ad Delivery
AD_RES=$(curl -s -X POST -H "Content-Type: application/json" \
  -d '{"placement":"HEADER_BANNER","device":"DESKTOP"}' \
  "${BACKEND_URL}/api/v1/ads/slot" || true)
TRACKING_TOKEN=$(echo "$AD_RES" | grep -o '"trackingToken":"[^"]*' | cut -d'"' -f4 || true)

if [ -n "$TRACKING_TOKEN" ]; then
  check_test "POST /api/v1/ads/slot (Delivery)" 0 "Ad delivered with valid tracking token"
  
  # 12. Impression
  IMP_RES=$(curl -s -X POST -H "Content-Type: application/json" \
    -d "{\"trackingToken\":\"${TRACKING_TOKEN}\",\"placement\":\"HEADER_BANNER\",\"device\":\"DESKTOP\"}" \
    "${BACKEND_URL}/api/v1/ads/impression" || true)
  if echo "$IMP_RES" | grep -q '"recorded":true'; then
    check_test "POST /api/v1/ads/impression" 0 "Impression recorded in DB"
  else
    check_test "POST /api/v1/ads/impression" 1 "Impression failed: ${IMP_RES}"
  fi

  # 13. Click
  CLICK_RES=$(curl -s -X POST -H "Content-Type: application/json" \
    -d "{\"trackingToken\":\"${TRACKING_TOKEN}\",\"placement\":\"HEADER_BANNER\",\"device\":\"DESKTOP\"}" \
    "${BACKEND_URL}/api/v1/ads/click" || true)
  if echo "$CLICK_RES" | grep -q '"destinationUrl"'; then
    check_test "POST /api/v1/ads/click" 0 "Click destination URL verified"
  else
    check_test "POST /api/v1/ads/click" 1 "Click failed: ${CLICK_RES}"
  fi
else
  check_test "POST /api/v1/ads/slot (Delivery)" 1 "No ad or tracking token delivered"
fi

echo ""
echo "6. Telemetry & Analytics Funnel..."

# 14. Telemetry Batch
TELEMETRY_BODY='[
  {"eventId":"evt_sh_1","eventType":"PAGE_VIEW","utilitySlug":"case-converter"},
  {"eventId":"evt_sh_2","eventType":"TOOL_START","utilitySlug":"case-converter"},
  {"eventId":"evt_sh_3","eventType":"TOOL_COMPLETE","utilitySlug":"case-converter","metadata":{"durationMs":35}}
]'
TELEMETRY_RES=$(curl -s -X POST -H "Content-Type: application/json" -d "$TELEMETRY_BODY" "${BACKEND_URL}/api/v1/analytics/events" || true)
if echo "$TELEMETRY_RES" | grep -q '"accepted":3'; then
  check_test "POST /api/v1/analytics/events" 0 "Batch funnel ingested (3 events)"
else
  check_test "POST /api/v1/analytics/events" 1 "Telemetry failed: ${TELEMETRY_RES}"
fi

echo ""
echo "============================================================"
echo " LAUNCH SMOKE TEST SUMMARY"
echo " Passed: ${PASSED} | Failed: ${FAILED}"
echo "============================================================"

if [ "$FAILED" -eq 0 ]; then
  echo "ALL LAUNCH SMOKE TESTS PASSED! Platform is operational for launch."
  exit 0
else
  echo "LAUNCH SMOKE TESTS FAILED! Review failing endpoints before launching."
  exit 1
fi
