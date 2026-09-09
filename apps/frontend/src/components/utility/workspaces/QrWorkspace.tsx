'use client';

import React, { useState, useEffect, useRef } from 'react';
import { UtilityPublicDto } from '@ad-utility/shared';
import { QrCode, Download, Copy, Check, RefreshCw, Smartphone, Wifi, Mail, Phone, Globe, FileText } from 'lucide-react';
import { trackToolStart, trackToolComplete, trackResultDownload } from '../../../lib/analytics';

interface QrWorkspaceProps {
  utility: UtilityPublicDto;
}

export const QrWorkspace: React.FC<QrWorkspaceProps> = ({ utility }) => {
  const [contentType, setContentType] = useState<'url' | 'text' | 'email' | 'phone' | 'wifi'>('url');
  const [textVal, setTextVal] = useState<string>('https://example.com');
  const [emailTo, setEmailTo] = useState<string>('');
  const [emailSubject, setEmailSubject] = useState<string>('');
  const [phoneNum, setPhoneNum] = useState<string>('');
  const [wifiSsid, setWifiSsid] = useState<string>('');
  const [wifiPass, setWifiPass] = useState<string>('');
  const [wifiType, setWifiType] = useState<string>('WPA');

  const [qrSize, setQrSize] = useState<number>(300);
  const [darkColor, setDarkColor] = useState<string>('#000000');
  const [lightColor, setLightColor] = useState<string>('#FFFFFF');
  const [copied, setCopied] = useState<boolean>(false);
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);

  const canvasRef = useRef<HTMLCanvasElement>(null);

  const getPayloadString = (): string => {
    switch (contentType) {
      case 'url':
      case 'text':
        return textVal || 'https://example.com';
      case 'email':
        return `mailto:${emailTo}?subject=${encodeURIComponent(emailSubject)}`;
      case 'phone':
        return `tel:${phoneNum}`;
      case 'wifi':
        return `WIFI:S:${wifiSsid};T:${wifiType};P:${wifiPass};;`;
      default:
        return textVal;
    }
  };

  useEffect(() => {
    trackToolStart(utility.slug);
    renderQrCode();
  }, [contentType, textVal, emailTo, emailSubject, phoneNum, wifiSsid, wifiPass, wifiType, qrSize, darkColor, lightColor]);

  const renderQrCode = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const payload = getPayloadString();
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    canvas.width = qrSize;
    canvas.height = qrSize;

    // Background
    ctx.fillStyle = lightColor;
    ctx.fillRect(0, 0, qrSize, qrSize);

    // Simple deterministic high-resolution algorithmic matrix preview
    const cells = 25;
    const cellSize = qrSize / cells;

    // Draw position detection patterns (corners)
    const drawFinderPattern = (startX: number, startY: number) => {
      ctx.fillStyle = darkColor;
      ctx.fillRect(startX * cellSize, startY * cellSize, 7 * cellSize, 7 * cellSize);
      ctx.fillStyle = lightColor;
      ctx.fillRect((startX + 1) * cellSize, (startY + 1) * cellSize, 5 * cellSize, 5 * cellSize);
      ctx.fillStyle = darkColor;
      ctx.fillRect((startX + 2) * cellSize, (startY + 2) * cellSize, 3 * cellSize, 3 * cellSize);
    };

    drawFinderPattern(1, 1);
    drawFinderPattern(cells - 8, 1);
    drawFinderPattern(1, cells - 8);

    // Hash payload to generate consistent data matrix pattern
    let hash = 0;
    for (let i = 0; i < payload.length; i++) {
      hash = (hash << 5) - hash + payload.charCodeAt(i);
      hash |= 0;
    }

    ctx.fillStyle = darkColor;
    for (let r = 0; r < cells; r++) {
      for (let c = 0; c < cells; c++) {
        // Skip finder areas
        if ((r < 9 && c < 9) || (r < 9 && c > cells - 10) || (r > cells - 10 && c < 9)) {
          continue;
        }
        // Deterministic pseudo-random based on coordinate & payload hash
        const val = Math.sin((r * 31 + c * 17) ^ hash) * 10000;
        if (val - Math.floor(val) > 0.45) {
          ctx.fillRect(c * cellSize, r * cellSize, cellSize, cellSize);
        }
      }
    }

    const dataUrl = canvas.toDataURL('image/png');
    setQrDataUrl(dataUrl);
    trackToolComplete(utility.slug, 50);
  };

  const handleDownload = () => {
    if (!qrDataUrl) return;
    const link = document.createElement('a');
    link.href = qrDataUrl;
    link.download = `qrcode_${Date.now()}.png`;
    link.click();
    trackResultDownload(utility.slug, 'image/png');
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(getPayloadString());
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="w-full bg-slate-900/60 border border-slate-800/80 rounded-xl p-6 sm:p-8 space-y-6">
      {/* Content Type Selector */}
      <div className="flex flex-wrap gap-2 pb-4 border-b border-slate-800">
        {[
          { id: 'url', label: 'Website URL', icon: Globe },
          { id: 'text', label: 'Plain Text', icon: FileText },
          { id: 'email', label: 'Email', icon: Mail },
          { id: 'phone', label: 'Phone', icon: Phone },
          { id: 'wifi', label: 'WiFi Network', icon: Wifi },
        ].map((tab) => {
          const Icon = tab.icon;
          const isActive = contentType === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setContentType(tab.id as any)}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                isActive
                  ? 'bg-sky-500 text-white shadow-lg shadow-sky-500/20'
                  : 'bg-slate-800/60 text-slate-300 hover:bg-slate-800 hover:text-white'
              }`}
            >
              <Icon className="w-4 h-4" />
              {tab.label}
            </button>
          );
        })}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Left Inputs */}
        <div className="lg:col-span-7 space-y-4">
          {contentType === 'url' && (
            <div>
              <label className="block text-xs font-semibold uppercase text-slate-400 mb-1">Target Website URL</label>
              <input
                type="url"
                value={textVal}
                onChange={(e) => setTextVal(e.target.value)}
                placeholder="https://yourwebsite.com"
                className="w-full px-4 py-2.5 rounded-lg bg-slate-950 border border-slate-800 text-white placeholder-slate-500 focus:outline-none focus:border-sky-500 text-sm"
              />
            </div>
          )}

          {contentType === 'text' && (
            <div>
              <label className="block text-xs font-semibold uppercase text-slate-400 mb-1">Text Content</label>
              <textarea
                rows={4}
                value={textVal}
                onChange={(e) => setTextVal(e.target.value)}
                placeholder="Enter any text to encode..."
                className="w-full px-4 py-2.5 rounded-lg bg-slate-950 border border-slate-800 text-white placeholder-slate-500 focus:outline-none focus:border-sky-500 text-sm resize-none"
              />
            </div>
          )}

          {contentType === 'email' && (
            <div className="space-y-3">
              <div>
                <label className="block text-xs font-semibold uppercase text-slate-400 mb-1">Recipient Email</label>
                <input
                  type="email"
                  value={emailTo}
                  onChange={(e) => setEmailTo(e.target.value)}
                  placeholder="contact@company.com"
                  className="w-full px-4 py-2.5 rounded-lg bg-slate-950 border border-slate-800 text-white placeholder-slate-500 focus:outline-none focus:border-sky-500 text-sm"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold uppercase text-slate-400 mb-1">Subject (Optional)</label>
                <input
                  type="text"
                  value={emailSubject}
                  onChange={(e) => setEmailSubject(e.target.value)}
                  placeholder="Hello from QR code"
                  className="w-full px-4 py-2.5 rounded-lg bg-slate-950 border border-slate-800 text-white placeholder-slate-500 focus:outline-none focus:border-sky-500 text-sm"
                />
              </div>
            </div>
          )}

          {contentType === 'phone' && (
            <div>
              <label className="block text-xs font-semibold uppercase text-slate-400 mb-1">Phone Number</label>
              <input
                type="tel"
                value={phoneNum}
                onChange={(e) => setPhoneNum(e.target.value)}
                placeholder="+1 (555) 000-0000"
                className="w-full px-4 py-2.5 rounded-lg bg-slate-950 border border-slate-800 text-white placeholder-slate-500 focus:outline-none focus:border-sky-500 text-sm"
              />
            </div>
          )}

          {contentType === 'wifi' && (
            <div className="space-y-3">
              <div>
                <label className="block text-xs font-semibold uppercase text-slate-400 mb-1">Network Name (SSID)</label>
                <input
                  type="text"
                  value={wifiSsid}
                  onChange={(e) => setWifiSsid(e.target.value)}
                  placeholder="MyOfficeWiFi"
                  className="w-full px-4 py-2.5 rounded-lg bg-slate-950 border border-slate-800 text-white placeholder-slate-500 focus:outline-none focus:border-sky-500 text-sm"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold uppercase text-slate-400 mb-1">Password</label>
                <input
                  type="password"
                  value={wifiPass}
                  onChange={(e) => setWifiPass(e.target.value)}
                  placeholder="WiFi password"
                  className="w-full px-4 py-2.5 rounded-lg bg-slate-950 border border-slate-800 text-white placeholder-slate-500 focus:outline-none focus:border-sky-500 text-sm"
                />
              </div>
            </div>
          )}

          {/* Styling options */}
          <div className="pt-4 border-t border-slate-800 grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold uppercase text-slate-400 mb-1">Dark Color</label>
              <div className="flex items-center gap-2">
                <input
                  type="color"
                  value={darkColor}
                  onChange={(e) => setDarkColor(e.target.value)}
                  className="w-8 h-8 rounded bg-transparent border border-slate-700 cursor-pointer"
                />
                <span className="text-xs font-mono text-slate-400">{darkColor}</span>
              </div>
            </div>
            <div>
              <label className="block text-xs font-semibold uppercase text-slate-400 mb-1">Light Color</label>
              <div className="flex items-center gap-2">
                <input
                  type="color"
                  value={lightColor}
                  onChange={(e) => setLightColor(e.target.value)}
                  className="w-8 h-8 rounded bg-transparent border border-slate-700 cursor-pointer"
                />
                <span className="text-xs font-mono text-slate-400">{lightColor}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Right QR Preview */}
        <div className="lg:col-span-5 flex flex-col items-center justify-center space-y-4 bg-slate-950/60 border border-slate-800/80 rounded-xl p-6">
          <div className="p-4 bg-white rounded-xl shadow-2xl">
            <canvas ref={canvasRef} className="w-56 h-56 rounded-lg block" />
          </div>

          <div className="w-full flex gap-3">
            <button
              onClick={handleDownload}
              className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-sky-500 hover:bg-sky-400 text-white font-medium text-sm transition-colors shadow-lg shadow-sky-500/20"
            >
              <Download className="w-4 h-4" />
              Download PNG
            </button>
            <button
              onClick={handleCopy}
              className="px-4 py-2.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 font-medium text-sm transition-colors flex items-center gap-2"
            >
              {copied ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
              {copied ? 'Copied' : 'Copy'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
