import React from 'react';

interface DivoLogoProps {
  size?: 'sm' | 'md' | 'lg' | 'xl' | 'card-foot' | 'badge';
  showSubtext?: boolean;
  showTapeMeasure?: boolean;
  className?: string;
  theme?: 'dark' | 'light';
}

export const DivoLogo: React.FC<DivoLogoProps> = ({
  size = 'md',
  showSubtext = true,
  showTapeMeasure = true,
  className = '',
  theme = 'dark',
}) => {
  const isLight = theme === 'light';
  const textColor = isLight ? 'text-black' : 'text-white';
  const subColor = isLight ? 'text-neutral-700' : 'text-[#FAF7F2]';

  // Compact size for table badges or small headers
  if (size === 'badge' || size === 'sm') {
    return (
      <div className={`inline-flex items-center gap-2 select-none ${className}`}>
        <div className="flex flex-col items-start leading-none">
          <span className={`font-montserrat font-black tracking-wider text-sm ${textColor}`}>
            DIVO
          </span>
          <span className="font-montserrat text-[7px] tracking-[0.2em] text-[#C5A059] uppercase font-semibold">
            Trajes & Etiqueta
          </span>
        </div>
        <div className="h-5 w-[1px] bg-[#C5A059]/40 mx-0.5"></div>
        <div className="flex items-baseline leading-none">
          <span className="font-old-standard text-lg text-[#C5A059] font-bold">20</span>
          <span className="font-old-standard italic text-xs text-[#C5A059] ml-0.5">años</span>
        </div>
      </div>
    );
  }

  // Card Foot variant (optimized for bottom of invitation card as seen in Slide 7)
  if (size === 'card-foot') {
    return (
      <div className={`flex flex-col items-center select-none ${className}`}>
        <div className="flex items-center gap-3">
          {/* DIVO Trajes y Etiqueta Box */}
          <div className="flex flex-col items-center">
            <div className="flex items-center">
              <span className="font-montserrat font-black text-xl tracking-[0.15em] text-white">
                DIVO
              </span>
            </div>
            <div className="border-t border-b border-white/60 w-full text-center py-[1.5px] px-1 mt-0.5">
              <span className="font-montserrat text-[6.5px] tracking-[0.25em] text-white/90 font-medium uppercase block">
                TRAJES Y ETIQUETA
              </span>
            </div>
          </div>

          <div className="h-8 w-[1px] bg-[#C5A059]/40"></div>

          {/* 20 años */}
          <div className="flex items-baseline">
            <span className="font-old-standard text-2xl font-bold text-[#C5A059] tracking-tight">20</span>
            <span className="font-old-standard italic text-sm text-[#C5A059] ml-1">años</span>
          </div>
        </div>

        {/* Measuring Tape Graphic (Cinta Métrica) */}
        {showTapeMeasure && (
          <div className="w-full max-w-[240px] my-1.5 px-2">
            <div className="flex justify-between items-end h-2 text-[#C5A059]/60">
              {[6, 8, 10, 12, 14, 16, 18, 20, 22, 24, 26].map((num, i) => (
                <div key={i} className="flex flex-col items-center">
                  <div className={`w-[1px] ${i % 2 === 0 ? 'h-2 bg-[#C5A059]' : 'h-1.5 bg-[#C5A059]/50'}`} />
                  <span className="text-[5px] font-mono tracking-tighter text-[#C5A059]/80 mt-[1px]">
                    {num < 10 ? `0${num}` : num}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* VISTIENDO MOMENTOS */}
        {showSubtext && (
          <div className="text-center mt-1">
            <span className="font-montserrat text-[7.5px] tracking-[0.45em] text-[#FAF7F2]/90 uppercase font-medium">
              V I S T I E N D O &nbsp; M O M E N T O S
            </span>
          </div>
        )}
      </div>
    );
  }

  // Standard & Large Sizes (Slide 4 and 8)
  const isLg = size === 'lg' || size === 'xl';

  return (
    <div className={`flex flex-col items-center select-none ${className}`}>
      <div className="flex items-center justify-center gap-4 sm:gap-6">
        {/* DIVO Box */}
        <div className="flex flex-col items-center">
          <h1 className={`font-montserrat font-black ${isLg ? 'text-4xl sm:text-5xl tracking-[0.18em]' : 'text-2xl sm:text-3xl tracking-[0.16em]'} ${textColor} leading-none`}>
            DIVO
          </h1>
          <div className={`border-t border-b ${isLight ? 'border-black/60' : 'border-white/70'} w-full text-center py-0.5 sm:py-1 px-1 sm:px-2 mt-1 sm:mt-1.5`}>
            <span className={`font-montserrat ${isLg ? 'text-[9px] sm:text-[11px]' : 'text-[7.5px] sm:text-[8.5px]'} tracking-[0.3em] ${textColor} font-semibold uppercase block`}>
              TRAJES Y ETIQUETA
            </span>
          </div>
        </div>

        {/* 20 Años in Gold Serif Italic */}
        <div className="flex items-baseline">
          <span className={`font-old-standard ${isLg ? 'text-5xl sm:text-6xl' : 'text-3xl sm:text-4xl'} font-bold text-[#C5A059] tracking-tight leading-none`}>
            20
          </span>
          <span className={`font-old-standard italic ${isLg ? 'text-3xl sm:text-4xl' : 'text-xl sm:text-2xl'} text-[#C5A059] ml-1 sm:ml-2 leading-none`}>
            años
          </span>
        </div>
      </div>

      {/* Cinta métrica (Tape measure motif) */}
      {showTapeMeasure && (
        <div className={`w-full ${isLg ? 'max-w-[420px] my-3' : 'max-w-[280px] my-2'} px-2 sm:px-4`}>
          <div className="flex justify-between items-end h-3 text-[#C5A059]">
            {[6, 8, 10, 12, 14, 16, 18, 20, 22, 24, 26].map((num, i) => (
              <div key={i} className="flex flex-col items-center">
                <div className={`w-[1px] ${i % 2 === 0 ? 'h-2.5 sm:h-3 bg-[#C5A059]' : 'h-1.5 sm:h-2 bg-[#C5A059]/60'}`} />
                <span className="text-[6px] sm:text-[7px] font-mono text-[#C5A059]/90 mt-[1px]">
                  {num < 10 ? `0${num}` : num}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* VISTIENDO MOMENTOS */}
      {showSubtext && (
        <div className="text-center mt-1">
          <span className={`font-montserrat ${isLg ? 'text-[11px] sm:text-[13px] tracking-[0.45em]' : 'text-[8.5px] sm:text-[10px] tracking-[0.38em]'} ${subColor} uppercase font-medium`}>
            VISTIENDO MOMENTOS
          </span>
        </div>
      )}
    </div>
  );
};
