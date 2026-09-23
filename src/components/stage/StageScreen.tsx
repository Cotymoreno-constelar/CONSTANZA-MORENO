import React, { useState } from 'react';
import { DivoLogo } from '../brand/DivoLogo';
import { Maximize2, Sparkles, Tv, Image as ImageIcon, Shirt } from 'lucide-react';

export const StageScreen: React.FC = () => {
  const [mode, setMode] = useState<'stage' | 'press-banner' | 'about'>('stage');

  return (
    <div className="w-full max-w-6xl mx-auto px-4 py-6 text-[#FAF7F2]">
      {/* View Switcher */}
      <div className="flex items-center justify-between pb-4 mb-4 border-b border-white/10">
        <div>
          <span className="font-montserrat text-[10px] tracking-[0.25em] text-[#C5A059] uppercase font-bold">
            PANTALLAS DEL EVENTO & VISUALES
          </span>
          <h2 className="font-montserrat text-xl font-bold text-white">
            Visuales de Escenario, Pasarela y Prensa
          </h2>
        </div>

        <div className="flex gap-2">
          <button
            onClick={() => setMode('stage')}
            className={`py-1.5 px-3 text-xs font-montserrat tracking-wider uppercase transition-colors ${
              mode === 'stage'
                ? 'bg-[#C5A059] text-black font-bold'
                : 'bg-[#1a1a1a] text-white/70 hover:text-white border border-white/10'
            }`}
          >
            Pantalla Escenario (Slide 8)
          </button>
          <button
            onClick={() => setMode('press-banner')}
            className={`py-1.5 px-3 text-xs font-montserrat tracking-wider uppercase transition-colors ${
              mode === 'press-banner'
                ? 'bg-[#C5A059] text-black font-bold'
                : 'bg-[#1a1a1a] text-white/70 hover:text-white border border-white/10'
            }`}
          >
            Banner Prensa (Slide 10)
          </button>
          <button
            onClick={() => setMode('about')}
            className={`py-1.5 px-3 text-xs font-montserrat tracking-wider uppercase transition-colors ${
              mode === 'about'
                ? 'bg-[#C5A059] text-black font-bold'
                : 'bg-[#1a1a1a] text-white/70 hover:text-white border border-white/10'
            }`}
          >
            Sobre el Evento (Slide 2)
          </button>
        </div>
      </div>

      {/* MODE 1: PANTALLA ESCENARIO (Slide 8) */}
      {mode === 'stage' && (
        <div className="relative w-full aspect-video bg-[#0a0a0a] border-4 border-[#8C6E38] shadow-2xl flex flex-col items-center justify-center p-8 overflow-hidden rounded-sm select-none">
          {/* Subtle stage spotlight effect */}
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(197,160,89,0.12)_0%,transparent_70%)] pointer-events-none"></div>

          {/* Golden frame hairline */}
          <div className="absolute inset-4 border border-[#C5A059]/40 pointer-events-none"></div>

          <DivoLogo
            size="xl"
            showSubtext={true}
            showTapeMeasure={true}
            className="transform scale-110 sm:scale-125"
          />

          <div className="absolute bottom-8 text-center">
            <span className="font-montserrat text-[10px] tracking-[0.4em] text-[#C5A059] uppercase">
              Capilla Paseo del Buen Pastor • Córdoba
            </span>
          </div>
        </div>
      )}

      {/* MODE 2: BANNER PRENSA (Slide 10 - Repeating Logo Pattern) */}
      {mode === 'press-banner' && (
        <div className="w-full bg-[#FAF7F2] p-8 rounded-sm shadow-2xl border border-neutral-300 text-black">
          <div className="text-center mb-6">
            <span className="font-old-standard italic text-2xl text-[#8C6E38] block">
              Banner prensa
            </span>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 gap-6 p-4">
            {[1, 2, 3, 4, 5, 6].map((idx) => (
              <div
                key={idx}
                className="flex items-center justify-center gap-3 p-4 border border-neutral-200 bg-white shadow-sm"
              >
                <div className="bg-black text-white px-2 py-1 flex flex-col items-center">
                  <span className="font-montserrat font-black text-sm tracking-widest leading-none">
                    DIVO
                  </span>
                  <span className="text-[5px] font-mono tracking-wider border-t border-white/50 w-full text-center mt-0.5">
                    TRAJES Y ETIQUETA
                  </span>
                </div>

                <div className="flex items-baseline">
                  <span className="font-old-standard text-2xl font-bold text-[#8C6E38]">20</span>
                  <span className="font-old-standard italic text-xs text-[#8C6E38] ml-0.5">años</span>
                </div>
              </div>
            ))}
          </div>

          <div className="text-center mt-6">
            <span className="font-montserrat text-xs tracking-[0.3em] text-neutral-600 uppercase">
              V i s t i e n d o &nbsp; m o m e n t o s
            </span>
          </div>
        </div>
      )}

      {/* MODE 3: SOBRE EL EVENTO (Slide 2) */}
      {mode === 'about' && (
        <div className="bg-[#111111] border border-[#C5A059]/40 p-8 rounded-sm shadow-2xl relative overflow-hidden">
          <div className="max-w-2xl mx-auto text-center">
            <span className="font-montserrat text-[10px] tracking-[0.3em] text-[#C5A059] uppercase font-semibold">
              DISEÑO & CONCEPTO
            </span>
            <h3 className="font-old-standard italic text-4xl text-[#FAF7F2] mt-2 mb-6">
              Sobre el evento
            </h3>

            <div className="w-24 h-[1px] bg-[#C5A059] mx-auto mb-6"></div>

            <p className="font-montserrat text-sm text-[#FAF7F2]/90 leading-relaxed text-justify mb-4">
              Contar el recorrido de la marca desde los inicios con el alquiler de trajes y luego la incorporación de vestidos hasta el presente, mostrando cómo evolucionó el diseño, los cortes y las tendencias a lo largo de dos décadas.
            </p>

            <p className="font-montserrat text-sm text-[#FAF7F2]/90 leading-relaxed text-justify">
              La idea es hacer un desfile conceptual estructurado como un viaje en el tiempo (década por década o bloques de años) que contrasta los primeros hitos de la marca con los trajes y vestidos actuales.
            </p>

            <div className="mt-8 pt-6 border-t border-white/10 flex flex-wrap items-center justify-around gap-4 text-xs font-mono text-[#E7CF98]">
              <div>📅 22 DE OCTUBRE DE 2026</div>
              <div>⏰ 19:00 HS</div>
              <div>📍 CAPILLA BUEN PASTOR, CÓRDOBA</div>
              <div>👔 GALA (PRENDAS DIVO)</div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
