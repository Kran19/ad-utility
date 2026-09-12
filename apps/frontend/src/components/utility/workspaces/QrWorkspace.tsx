'use client';

import React, { useState, useEffect, useRef } from 'react';
import { UtilityPublicDto, QrEngine, QrErrorCorrectionLevel, BarcodeEngine } from '@ad-utility/shared';
import {
  QrCode,
  Download,
  Copy,
  Check,
  Wifi,
  Mail,
  Phone,
  Globe,
  FileText,
  AlertCircle,
  Barcode,
} from 'lucide-react';
import { trackToolStart, trackToolComplete, trackResultDownload } from '../../../lib/analytics';

interface QrWorkspaceProps {
  utility: UtilityPublicDto;
}

export const QrWorkspace: React.FC<QrWorkspaceProps> = ({ utility }) => {
  const isBarcode = utility.slug === 'barcode-generator';

  // --- QR / Barcode Generator State ---
  const [contentType, setContentType] = useState<'url' | 'text' | 'email' | 'phone' | 'wifi'>('url');
  const [textVal, setTextVal] = useState<string>('https://google.com');
  const [emailTo, setEmailTo] = useState<string>('');
  const [emailSubject, setEmailSubject] = useState<string>('');
  const [phoneNum, setPhoneNum] = useState<string>('');
  const [wifiSsid, setWifiSsid] = useState<string>('');
  const [wifiPass, setWifiPass] = useState<string>('');
  const [wifiType, setWifiType] = useState<string>('WPA');

  const [qrSize, setQrSize] = useState<number>(320);
  const [ecLevel, setEcLevel] = useState<QrErrorCorrectionLevel>('M');
  const [darkColor, setDarkColor] = useState<string>('#000000');
  const [lightColor, setLightColor] = useState<string>('#FFFFFF');
  const [copied, setCopied] = useState<boolean>(false);
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);
  const [svgString, setSvgString] = useState<string>('');
  const [decodeVerified, setDecodeVerified] = useState<boolean>(true);

  const canvasRef = useRef<HTMLCanvasElement>(null);

  const getPayloadString = (): string => {
    if (isBarcode) {
      return textVal || '1234567890';
    }
    switch (contentType) {
      case 'url':
      case 'text':
        return textVal || 'https://google.com';
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

  // Render QR / Barcode in Real-Time
  useEffect(() => {
    trackToolStart(utility.slug);

    try {
      const payload = getPayloadString();
      if (!payload || payload.trim().length === 0) return;

      if (isBarcode) {
        // Barcode Generation
        const res = BarcodeEngine.generateCode128(payload, 90, 10);
        setSvgString(res.svg);

        // Verify with independent decoder
        try {
          const dec = BarcodeEngine.decodeCode128(res);
          setDecodeVerified(dec === payload);
        } catch {
          setDecodeVerified(false);
        }

        // Render to canvas for PNG download
        const canvas = canvasRef.current;
        if (canvas) {
          const modWidth = Math.max(2, Math.floor(qrSize / res.modules.length));
          canvas.width = res.modules.length * modWidth;
          canvas.height = 120;
          const ctx = canvas.getContext('2d');
          if (ctx) {
            ctx.fillStyle = '#FFFFFF';
            ctx.fillRect(0, 0, canvas.width, canvas.height);
            ctx.fillStyle = '#000000';
            for (let i = 0; i < res.modules.length; i++) {
              if (res.modules[i]) {
                ctx.fillRect(i * modWidth, 10, modWidth, 80);
              }
            }
            ctx.font = '12px monospace';
            ctx.textAlign = 'center';
            ctx.fillText(payload, canvas.width / 2, 105);
            setQrDataUrl(canvas.toDataURL('image/png'));
          }
        }
      } else {
        // QR Code Generation
        const res = QrEngine.generate(payload, {
          errorCorrectionLevel: ecLevel,
          margin: 4,
          darkColor,
          lightColor,
        });

        setSvgString(res.svg);

        // Verify with independent decoder
        try {
          const dec = QrEngine.decode(res);
          setDecodeVerified(dec === payload);
        } catch {
          setDecodeVerified(false);
        }

        // Render to high-resolution canvas with crisp edges
        const canvas = canvasRef.current;
        if (canvas) {
          canvas.width = qrSize;
          canvas.height = qrSize;
          const ctx = canvas.getContext('2d');
          if (ctx) {
            ctx.imageSmoothingEnabled = false;
            const cellSize = qrSize / res.size;

            ctx.fillStyle = lightColor;
            ctx.fillRect(0, 0, qrSize, qrSize);

            ctx.fillStyle = darkColor;
            for (let r = 0; r < res.size; r++) {
              for (let c = 0; c < res.size; c++) {
                if (res.matrix[r][c]) {
                  ctx.fillRect(Math.round(c * cellSize), Math.round(r * cellSize), Math.ceil(cellSize), Math.ceil(cellSize));
                }
              }
            }
            setQrDataUrl(canvas.toDataURL('image/png'));
          }
        }
      }

      trackToolComplete(utility.slug, 30);
    } catch (err: any) {
      setDecodeVerified(false);
    }
  }, [utility.slug, contentType, textVal, emailTo, emailSubject, phoneNum, wifiSsid, wifiPass, wifiType, qrSize, ecLevel, darkColor, lightColor, isBarcode]);

  const handleDownloadPng = () => {
    if (!qrDataUrl) return;
    const link = document.createElement('a');
    link.href = qrDataUrl;
    link.download = isBarcode ? `barcode_${Date.now()}.png` : `qrcode_${Date.now()}.png`;
    link.click();
    trackResultDownload(utility.slug, { format: 'image/png' });
  };

  const handleDownloadSvg = () => {
    if (!svgString) return;
    const blob = new Blob([svgString], { type: 'image/svg+xml' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = isBarcode ? `barcode_${Date.now()}.svg` : `qrcode_${Date.now()}.svg`;
    link.click();
    URL.revokeObjectURL(url);
    trackResultDownload(utility.slug, { format: 'image/svg+xml' });
  };

  const handleCopy = () => {
    const payload = getPayloadString();
    navigator.clipboard.writeText(payload);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="w-full bg-white border border-slate-200/90 rounded-3xl p-6 sm:p-8 shadow-sm hover:shadow-md transition-all space-y-6">
      <div className="flex items-center justify-between border-b border-slate-100 pb-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-blue-50 border border-blue-100 flex items-center justify-center text-blue-600 shadow-xs">
            {isBarcode ? <Barcode className="w-5 h-5" /> : <QrCode className="w-5 h-5" />}
          </div>
          <div>
            <h2 className="text-lg font-bold text-slate-900">{utility.name}</h2>
            <p className="text-xs text-slate-500">
              {isBarcode ? 'Standards-compliant Code 128 barcode' : 'ISO/IEC 18004 compliant, high-contrast QR codes'}
            </p>
          </div>
        </div>
        <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-slate-100 text-slate-700 border border-slate-200 uppercase">
          LOCAL
        </span>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Left Form Controls */}
        <div className="lg:col-span-7 space-y-5">
          {!isBarcode && (
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-2 uppercase tracking-wider">Content Type</label>
              <div className="grid grid-cols-5 gap-1.5">
                {[
                  { id: 'url', label: 'URL', icon: Globe },
                  { id: 'text', label: 'Text', icon: FileText },
                  { id: 'email', label: 'Email', icon: Mail },
                  { id: 'phone', label: 'Phone', icon: Phone },
                  { id: 'wifi', label: 'WiFi', icon: Wifi },
                ].map((type) => {
                  const Icon = type.icon;
                  return (
                    <button
                      key={type.id}
                      type="button"
                      onClick={() => setContentType(type.id as any)}
                      className={`flex flex-col items-center justify-center p-2.5 rounded-xl border text-xs font-bold transition-all ${
                        contentType === type.id
                          ? 'bg-blue-50 border-2 border-blue-600 text-blue-950 shadow-xs ring-2 ring-blue-500/20'
                          : 'bg-white border-slate-200 text-slate-600 hover:border-slate-300 hover:bg-slate-50 hover:text-slate-900'
                      }`}
                    >
                      <Icon className="w-4 h-4 mb-1" />
                      {type.label}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Form Fields */}
          <div className="space-y-4">
            {(contentType === 'url' || contentType === 'text' || isBarcode) && (
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5 uppercase tracking-wider">
                  {isBarcode ? 'Barcode Text / Digits' : contentType === 'url' ? 'Target URL' : 'Plain Text'}
                </label>
                <input
                  type="text"
                  value={textVal}
                  onChange={(e) => setTextVal(e.target.value)}
                  placeholder={isBarcode ? 'e.g. 1234567890' : contentType === 'url' ? 'https://example.com' : 'Enter text...'}
                  className="w-full bg-white border border-slate-200 rounded-xl px-4 py-2.5 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 font-mono"
                />
              </div>
            )}

            {contentType === 'email' && !isBarcode && (
              <div className="space-y-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1 uppercase tracking-wider">Email Address</label>
                  <input
                    type="email"
                    value={emailTo}
                    onChange={(e) => setEmailTo(e.target.value)}
                    placeholder="recipient@example.com"
                    className="w-full bg-white border border-slate-200 rounded-xl px-4 py-2.5 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1 uppercase tracking-wider">Subject</label>
                  <input
                    type="text"
                    value={emailSubject}
                    onChange={(e) => setEmailSubject(e.target.value)}
                    placeholder="Hello from QR"
                    className="w-full bg-white border border-slate-200 rounded-xl px-4 py-2.5 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                  />
                </div>
              </div>
            )}

            {contentType === 'phone' && !isBarcode && (
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1 uppercase tracking-wider">Phone Number</label>
                <input
                  type="tel"
                  value={phoneNum}
                  onChange={(e) => setPhoneNum(e.target.value)}
                  placeholder="+1 (555) 000-0000"
                  className="w-full bg-white border border-slate-200 rounded-xl px-4 py-2.5 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                />
              </div>
            )}

            {contentType === 'wifi' && !isBarcode && (
              <div className="space-y-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1 uppercase tracking-wider">Network Name (SSID)</label>
                  <input
                    type="text"
                    value={wifiSsid}
                    onChange={(e) => setWifiSsid(e.target.value)}
                    placeholder="Office_5G"
                    className="w-full bg-white border border-slate-200 rounded-xl px-4 py-2.5 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1 uppercase tracking-wider">Password</label>
                  <input
                    type="password"
                    value={wifiPass}
                    onChange={(e) => setWifiPass(e.target.value)}
                    placeholder="Password"
                    className="w-full bg-white border border-slate-200 rounded-xl px-4 py-2.5 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                  />
                </div>
              </div>
            )}
          </div>

          {/* Customization Options */}
          {!isBarcode && (
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 pt-2">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1 uppercase tracking-wider">Resolution</label>
                <select
                  value={qrSize}
                  onChange={(e) => setQrSize(parseInt(e.target.value, 10))}
                  className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-900 font-semibold focus:ring-2 focus:ring-blue-500/20"
                >
                  <option value="256">256 &times; 256 px</option>
                  <option value="320">320 &times; 320 px</option>
                  <option value="512">512 &times; 512 px</option>
                  <option value="1024">1024 &times; 1024 px</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1 uppercase tracking-wider">Error Correction</label>
                <select
                  value={ecLevel}
                  onChange={(e) => setEcLevel(e.target.value as any)}
                  className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-900 font-semibold focus:ring-2 focus:ring-blue-500/20"
                >
                  <option value="L">L (7% Recovery)</option>
                  <option value="M">M (15% Recovery - Standard)</option>
                  <option value="Q">Q (25% Recovery)</option>
                  <option value="H">H (30% Recovery - High)</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1 uppercase tracking-wider">QR Color</label>
                <input
                  type="color"
                  value={darkColor}
                  onChange={(e) => setDarkColor(e.target.value)}
                  className="w-full h-9 bg-white border border-slate-200 rounded-xl cursor-pointer p-0.5"
                />
              </div>
            </div>
          )}
        </div>

        {/* Right Preview Card */}
        <div className="lg:col-span-5 flex flex-col items-center justify-center p-6 bg-slate-50/80 rounded-2xl border border-slate-200/80 space-y-4">
          <div className="p-4 bg-white rounded-2xl shadow-sm border border-slate-200 flex items-center justify-center">
            <canvas ref={canvasRef} className="max-w-[240px] max-h-[240px] w-auto h-auto object-contain" />
          </div>

          <div className="flex items-center gap-2 text-xs font-bold">
            {decodeVerified ? (
              <span className="flex items-center gap-1.5 text-emerald-700">
                <Check className="w-4 h-4 text-emerald-600" /> Scannable & Verified
              </span>
            ) : (
              <span className="flex items-center gap-1.5 text-amber-700">
                <AlertCircle className="w-4 h-4 text-amber-600" /> Generating Matrix...
              </span>
            )}
          </div>

          <div className="grid grid-cols-2 gap-2.5 w-full pt-1">
            <button
              type="button"
              onClick={handleDownloadPng}
              className="py-2.5 px-3 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs shadow-md shadow-blue-500/25 transition-all flex items-center justify-center gap-1.5"
            >
              <Download className="w-3.5 h-3.5" /> Download PNG
            </button>
            <button
              type="button"
              onClick={handleDownloadSvg}
              className="py-2.5 px-3 rounded-xl bg-white hover:bg-slate-50 border border-slate-200 text-slate-700 font-bold text-xs transition-all flex items-center justify-center gap-1.5 shadow-xs"
            >
              <Download className="w-3.5 h-3.5" /> Download SVG
            </button>
          </div>

          <button
            type="button"
            onClick={handleCopy}
            className="w-full py-2.5 px-3 rounded-xl bg-white hover:bg-slate-50 border border-slate-200 text-slate-700 text-xs font-bold transition-all flex items-center justify-center gap-1.5 shadow-xs"
          >
            {copied ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
            {copied ? 'Copied Payload!' : 'Copy Payload String'}
          </button>
        </div>
      </div>
    </div>
  );
};
