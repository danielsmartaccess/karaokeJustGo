import React from 'react';
import { QRCodeSVG } from 'qrcode.react';
import Logo from './Logo';

interface QRCodeDisplayProps {
  url: string;
  label?: string;
  size?: number;
  dark?: boolean;
}

export default function QRCodeDisplay({ url, label = 'Escaneie para participar', size = 220, dark = false }: QRCodeDisplayProps) {
  return (
    <div className={`flex flex-col items-center gap-6 ${dark ? '' : ''}`}>
      <div className="bg-white p-4 rounded-2xl shadow-2xl" style={{ boxShadow: '0 0 40px rgba(0,212,224,0.3), 0 0 80px rgba(233,30,140,0.15)' }}>
        <QRCodeSVG
          value={url}
          size={size}
          level="H"
          includeMargin={false}
          fgColor="#06000e"
          bgColor="#ffffff"
        />
      </div>
      <div className="text-center">
        <p className="text-slate-300 text-sm font-medium mb-1">{label}</p>
        <p className="text-slate-600 font-mono text-xs break-all max-w-xs">{url}</p>
      </div>
    </div>
  );
}

// Full telão view for the QR code
export function QRCodeTelaoMode({ url }: { url: string }) {
  return (
    <div className="flex-1 flex flex-col items-center justify-center gap-10 bg-[#06000e] px-8">
      <Logo size="lg" showTagline />

      <div className="text-center mb-2">
        <p className="text-xs font-mono text-pink-500 tracking-[0.35em] uppercase mb-3">
          Junte-se ao Karaokê!
        </p>
        <h1 className="text-4xl md:text-6xl font-display font-black text-white leading-none gradient-title">
          Escaneie e Cante!
        </h1>
      </div>

      <QRCodeDisplay url={url} size={260} />

      <div className="flex items-center gap-4 text-slate-600 text-sm">
        <div className="h-px bg-slate-800 w-16" />
        <span className="font-mono text-xs tracking-wider">ou acesse o link acima</span>
        <div className="h-px bg-slate-800 w-16" />
      </div>

      <div className="text-xs font-mono text-slate-700 tracking-[0.3em] uppercase">
        Bar & Karaokê Just Go — Smart Access
      </div>
    </div>
  );
}
