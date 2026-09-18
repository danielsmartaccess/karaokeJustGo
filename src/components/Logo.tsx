interface LogoProps {
  size?: 'sm' | 'md' | 'lg';
  showTagline?: boolean;
  className?: string;
}

const markSizes = { sm: 28, md: 36, lg: 52 };
const textSizes = { sm: 'text-base', md: 'text-lg', lg: 'text-2xl' };

/**
 * Marca oficial da Just Go, servida de public/ (mesmo arquivo usado como
 * ícone do PWA e favicon — uma origem só para a identidade visual).
 * BASE_URL respeita o subcaminho do GitHub Pages.
 */
const BRAND_MARK = `${import.meta.env.BASE_URL}icon-192.png`;

export default function Logo({ size = 'md', showTagline = false, className = '' }: LogoProps) {
  const markSize = markSizes[size];

  return (
    <div className={`flex items-center gap-2.5 ${className}`}>
      <img
        src={BRAND_MARK}
        alt="Just Go"
        width={markSize}
        height={markSize}
        className="shrink-0 rounded-xl"
        style={{ boxShadow: '0 0 18px rgba(1, 173, 239, 0.35)' }}
      />
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
