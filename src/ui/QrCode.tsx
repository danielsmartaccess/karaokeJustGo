import { useEffect, useRef, useState } from 'react';
import QRCode from 'qrcode';
import { cn } from '../lib/utils';

interface QrCodeProps {
  value: string;
  size?: number;
  className?: string;
}

export function QrCode({ value, size = 96, className }: QrCodeProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [errored, setErrored] = useState(false);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    setErrored(false);
    QRCode.toCanvas(canvas, value, {
      width: size,
      margin: 1,
      color: { dark: '#001624', light: '#f8f8fc' },
    }).catch(() => setErrored(true));
  }, [value, size]);

  if (errored) {
    return (
      <div
        className={cn('flex items-center justify-center rounded-xl bg-stage-800 text-center text-xs text-muted', className)}
        style={{ width: size, height: size }}
      >
        QR indisponível
      </div>
    );
  }

  return (
    <canvas
      ref={canvasRef}
      width={size}
      height={size}
      className={cn('rounded-xl', className)}
      style={{ width: size, height: size }}
      role="img"
      aria-label={`QR code para ${value}`}
    />
  );
}
