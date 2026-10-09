import React, { useState, useEffect } from 'react';

export const CUSTOM_LOGO_STORAGE_KEY = 'divo_custom_logo_data_url';
export const CUSTOM_LOGO_EVENT = 'divo-logo-updated';

export const getCustomLogoUrl = (): string | null => {
  try {
    return localStorage.getItem(CUSTOM_LOGO_STORAGE_KEY);
  } catch {
    return null;
  }
};

export const setCustomLogoUrl = (dataUrl: string | null): void => {
  try {
    if (dataUrl) {
      localStorage.setItem(CUSTOM_LOGO_STORAGE_KEY, dataUrl);
    } else {
      localStorage.removeItem(CUSTOM_LOGO_STORAGE_KEY);
    }
    window.dispatchEvent(new Event(CUSTOM_LOGO_EVENT));
  } catch (err) {
    console.error('Error guardando el logo personalizado:', err);
  }
};

interface DivoLogoProps {
  size?: 'sm' | 'md' | 'lg' | 'xl' | 'card-foot' | 'badge';
  showSubtext?: boolean;
  showTapeMeasure?: boolean;
  className?: string;
  theme?: 'dark' | 'light';
}

/**
 * Vector exacto del logo oficial de DIVO TRAJES Y ETIQUETA (con la V alada superior,
 * tipografía geométrica ancha y filetes horizontales partidos).
 * Si el usuario sube además el PNG por el panel Admin, usa el PNG manteniendo "20 años" al lado.
 */
const DivoOfficialMark: React.FC<{
  customLogo: string | null;
  className?: string;
  isLight?: boolean;
}> = ({ customLogo, className = '', isLight = false }) => {
  if (customLogo) {
    return (
      <img
        src={customLogo}
        alt="DIVO Trajes y Etiqueta"
        className={`${className} w-auto object-contain select-none`}
        crossOrigin="anonymous"
      />
    );
  }

  const fillColor = isLight ? '#000000' : '#FFFFFF';

  return (
    <svg
      viewBox="0 0 1000 300"
      className={`${className} w-auto select-none overflow-visible`}
      aria-label="DIVO Trajes y Etiqueta"
      role="img"
    >
      <defs>
        <filter id="divo-drop-shadow" x="-10%" y="-10%" width="120%" height="130%">
          <feDropShadow dx="0" dy="3" stdDeviation="4" floodColor="#000000" floodOpacity="0.65" />
        </filter>
      </defs>
      <g fill={fillColor} filter={isLight ? undefined : 'url(#divo-drop-shadow)'}>
        {/* V central con alas horizontales superiores extendidas sobre D-I y O */}
        <path d="M 33 28 L 383 28 L 514 159 L 645 28 L 964 28 L 964 41 L 684 41 L 530 194 L 499 194 L 345 41 L 33 41 Z" />

        {/* Letra D geométrica ancha */}
        <path
          fillRule="evenodd"
          d="M 33 62 L 155 62 C 242 62 298 83 298 114.5 C 298 146 242 167 155 167 L 33 167 Z M 78 77 L 148 77 C 215 77 252 91 252 114.5 C 252 138 215 152 148 152 L 78 152 Z"
        />

        {/* Letra I */}
        <rect x="322" y="62" width="31" height="105" />

        {/* Letra O ovalada ancha */}
        <path
          fillRule="evenodd"
          d="M 804 57 A 160 57.5 0 1 0 804 172 A 160 57.5 0 1 0 804 57 Z M 804 73 A 114 41.5 0 1 1 804 156 A 114 41.5 0 1 1 804 73 Z"
        />

        {/* Líneas horizontales intermedias partidas a los lados del vértice de la V */}
        <rect x="33" y="185" width="451" height="9" />
        <rect x="549" y="185" width="415" height="9" />

        {/* Texto TRAJES Y ETIQUETA en serif clásica con espaciado ancho */}
        <text
          x="498"
          y="241"
          textAnchor="middle"
          fontFamily="'Old Standard TT', Georgia, 'Times New Roman', serif"
          fontWeight="700"
          fontSize="47"
          letterSpacing="11"
          fill={fillColor}
        >
          TRAJES &#160; Y &#160; ETIQUETA
        </text>

        {/* Línea horizontal inferior continua */}
        <rect x="33" y="256" width="931" height="9" />
      </g>
    </svg>
  );
};

export const DivoLogo: React.FC<DivoLogoProps> = ({
  size = 'md',
  showSubtext = true,
  showTapeMeasure = true,
  className = '',
  theme = 'dark',
}) => {
  const [customLogo, setCustomLogo] = useState<string | null>(() => getCustomLogoUrl());

  useEffect(() => {
    const handleLogoChange = () => {
      setCustomLogo(getCustomLogoUrl());
    };
    window.addEventListener(CUSTOM_LOGO_EVENT, handleLogoChange);
    window.addEventListener('storage', handleLogoChange);
    return () => {
      window.removeEventListener(CUSTOM_LOGO_EVENT, handleLogoChange);
      window.removeEventListener('storage', handleLogoChange);
    };
  }, []);

  const isLight = theme === 'light';
  const subColor = isLight ? 'text-neutral-700' : 'text-[#FAF7F2]';

  // Compact size for table badges or top navigation bar
  if (size === 'badge' || size === 'sm') {
    return (
      <div className={`inline-flex items-center gap-2.5 select-none ${className}`}>
        <DivoOfficialMark
          customLogo={customLogo}
          isLight={isLight}
          className={size === 'badge' ? 'h-6 sm:h-7' : 'h-7 sm:h-8'}
        />
        <div className="h-5 w-[1px] bg-[#C5A059]/40 mx-0.5"></div>
        <div className="flex items-baseline leading-none">
          <span className="font-old-standard text-lg sm:text-xl text-[#C5A059] font-bold">20</span>
          <span className="font-old-standard italic text-xs sm:text-sm text-[#C5A059] ml-0.5">años</span>
        </div>
      </div>
    );
  }

  // Card Foot variant (optimized for bottom of invitation card)
  if (size === 'card-foot') {
    return (
      <div className={`flex flex-col items-center select-none ${className}`}>
        <div className="flex items-center gap-3">
          {/* Official DIVO Trajes y Etiqueta Logo */}
          <DivoOfficialMark
            customLogo={customLogo}
            isLight={false}
            className="h-9 sm:h-10"
          />

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

  // Standard & Large Sizes (md, lg, xl)
  const isLg = size === 'lg' || size === 'xl';

  return (
    <div className={`flex flex-col items-center select-none ${className}`}>
      <div className="flex items-center justify-center gap-3 sm:gap-5">
        {/* Official DIVO Trajes y Etiqueta Logo */}
        <DivoOfficialMark
          customLogo={customLogo}
          isLight={isLight}
          className={
            size === 'xl'
              ? 'h-16 sm:h-24'
              : size === 'lg'
              ? 'h-14 sm:h-20'
              : 'h-11 sm:h-14'
          }
        />

        <div className={`${isLg ? 'h-12 sm:h-16' : 'h-9 sm:h-11'} w-[1px] bg-[#C5A059]/40`}></div>

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
