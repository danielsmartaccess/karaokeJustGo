import React from 'react';

interface LogoProps {
  size?: 'sm' | 'md' | 'lg';
  showTagline?: boolean;
  className?: string;
}

const iconSizes = { sm: 24, md: 32, lg: 48 };
const textSizes = { sm: 'text-base', md: 'text-lg', lg: 'text-2xl' };

function MicIcon({ size }: { size: number }) {
  const s = size;
  return (
    <svg
      width={s}
      height={s}
      viewBox="0 0 48 48"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      style={{ flexShrink: 0 }}
    >
      <defs>
        <linearGradient id="micGrad" x1="0" y1="0" x2="48" y2="48" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#e91e8c" />
          <stop offset="100%" stopColor="#9b27af" />
        </linearGradient>
        <filter id="micGlow">
          <feGaussianBlur stdDeviation="2" result="blur" />
          <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
        </filter>
      </defs>
      {/* mic body */}
      <rect x="17" y="4" width="14" height="22" rx="7" fill="url(#micGrad)" filter="url(#micGlow)" />
      {/* arc */}
      <path
        d="M10 24c0 7.732 6.268 14 14 14s14-6.268 14-14"
        stroke="url(#micGrad)"
        strokeWidth="3"
        strokeLinecap="round"
        fill="none"
        filter="url(#micGlow)"
      />
      {/* stand */}
      <line x1="24" y1="38" x2="24" y2="44" stroke="url(#micGrad)" strokeWidth="3" strokeLinecap="round" />
      <line x1="16" y1="44" x2="32" y2="44" stroke="url(#micGrad)" strokeWidth="3" strokeLinecap="round" />
    </svg>
  );
}

export default function Logo({ size = 'md', showTagline = false, className = '' }: LogoProps) {
  return (
    <div className={`flex items-center gap-2.5 ${className}`}>
      <MicIcon size={iconSizes[size]} />
      <div className="leading-none">
        <div className={`font-display font-black tracking-tight ${textSizes[size]}`}>
          <span className="text-white">Karaokê </span>
          <span className="gradient-title">Just Go</span>
        </div>
        {showTagline && (
          <div className="text-[10px] font-mono text-slate-600 tracking-[0.2em] uppercase mt-0.5">
            Smart Access
          </div>
        )}
      </div>
    </div>
  );
}
