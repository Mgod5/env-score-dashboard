import React from 'react';
import { motion } from 'framer-motion';
import { Activity, TrendingUp, TrendingDown, Info, ShieldAlert, BarChart2, Zap } from 'lucide-react';
import { InstrumentScore } from '@workspace/api-client-react';
import { cn, formatNumber } from '../lib/utils';

interface InstrumentCardProps {
  instrument: InstrumentScore;
  index: number;
}

function formatMomentum(val: number): string {
  return `${val >= 0 ? '+' : ''}${val.toFixed(2)}%`;
}

function formatVolume(val: number): string {
  if (val >= 1e9) return `${(val / 1e9).toFixed(2)}B`;
  if (val >= 1e6) return `${(val / 1e6).toFixed(2)}M`;
  if (val >= 1e3) return `${(val / 1e3).toFixed(1)}K`;
  return val.toFixed(0);
}

export const InstrumentCard: React.FC<InstrumentCardProps> = ({ instrument, index }) => {
  const {
    name, ticker, score, rawScore, subScore,
    atr, adx, momentum, avgVolume,
    explanation, riskGuidance, colorCategory,
  } = instrument;

  const isTied     = rawScore >= 100 && subScore > 0;
  const isTieWinner = score === 100 && rawScore >= 100 && subScore > 0;

  const colorMap = {
    green: {
      text:   'text-success',
      bg:     'bg-success/20',
      border: 'border-success/30',
      fill:   'bg-success',
      glow:   'group-hover:shadow-[0_0_30px_-5px_rgba(74,222,128,0.3)]',
    },
    yellow: {
      text:   'text-warning',
      bg:     'bg-warning/20',
      border: 'border-warning/30',
      fill:   'bg-warning',
      glow:   'group-hover:shadow-[0_0_30px_-5px_rgba(250,204,21,0.3)]',
    },
    red: {
      text:   'text-destructive',
      bg:     'bg-destructive/20',
      border: 'border-destructive/30',
      fill:   'bg-destructive',
      glow:   'group-hover:shadow-[0_0_30px_-5px_rgba(239,68,68,0.3)]',
    },
  };

  const colors = colorMap[colorCategory] ?? colorMap.yellow;

  const momentumPositive = momentum >= 0;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: index * 0.1, ease: 'easeOut' }}
      className={cn(
        'group relative flex flex-col justify-between overflow-hidden rounded-2xl glass-panel p-6 transition-all duration-300',
        'hover:-translate-y-1 hover:border-white/20',
        colors.glow,
        isTieWinner && 'ring-1 ring-primary/40',
      )}
    >
      {/* Ambient glow */}
      <div className={cn('absolute -top-24 -right-24 h-48 w-48 rounded-full blur-3xl opacity-20 transition-opacity duration-500 group-hover:opacity-40', colors.fill)} />

      <div className="relative z-10">
        {/* Header */}
        <div className="flex justify-between items-start mb-4">
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-medium text-muted-foreground uppercase tracking-wider">{name}</h3>
              {isTieWinner && (
                <span className="text-[10px] font-mono font-bold px-1.5 py-0.5 rounded bg-primary/20 text-primary border border-primary/30 uppercase tracking-wider">
                  Tie Winner
                </span>
              )}
            </div>
            <span className="text-2xl font-display font-bold text-foreground mt-1 block">{ticker}</span>
          </div>

          <div className="flex flex-col items-end">
            <span className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground mb-1">Env Score</span>
            <div className={cn('text-4xl font-display font-bold tracking-tighter drop-shadow-md', colors.text)}>
              {score}
            </div>
            {isTied && (
              <span className="text-[10px] font-mono text-muted-foreground mt-0.5">
                sub +{subScore}/10
              </span>
            )}
          </div>
        </div>

        {/* Progress Bar */}
        <div className="w-full h-2 bg-black/40 rounded-full overflow-hidden mb-6 border border-white/5">
          <motion.div
            initial={{ width: 0 }}
            animate={{ width: `${Math.min(score, 100)}%` }}
            transition={{ duration: 1, delay: 0.2 + index * 0.1, ease: 'easeOut' }}
            className={cn('h-full rounded-full', colors.fill)}
          />
        </div>

        {/* Metrics Grid — 4 cells */}
        <div className="grid grid-cols-2 gap-3 mb-6">
          <div className="bg-black/30 rounded-xl p-3 border border-white/5">
            <div className="flex items-center gap-1.5 text-muted-foreground mb-1.5">
              <Activity size={13} />
              <span className="text-[11px] uppercase tracking-wider font-semibold">ATR</span>
            </div>
            <span className="text-base font-mono text-foreground">{formatNumber(atr, 4)}</span>
          </div>

          <div className="bg-black/30 rounded-xl p-3 border border-white/5">
            <div className="flex items-center gap-1.5 text-muted-foreground mb-1.5">
              <TrendingUp size={13} />
              <span className="text-[11px] uppercase tracking-wider font-semibold">ADX</span>
            </div>
            <span className="text-base font-mono text-foreground">{formatNumber(adx, 2)}</span>
          </div>

          <div className="bg-black/30 rounded-xl p-3 border border-white/5">
            <div className="flex items-center gap-1.5 text-muted-foreground mb-1.5">
              {momentumPositive
                ? <TrendingUp size={13} className="text-success" />
                : <TrendingDown size={13} className="text-destructive" />}
              <span className="text-[11px] uppercase tracking-wider font-semibold">7d Momentum</span>
            </div>
            <span className={cn('text-base font-mono', momentumPositive ? 'text-success' : 'text-destructive')}>
              {formatMomentum(momentum)}
            </span>
          </div>

          <div className="bg-black/30 rounded-xl p-3 border border-white/5">
            <div className="flex items-center gap-1.5 text-muted-foreground mb-1.5">
              <BarChart2 size={13} />
              <span className="text-[11px] uppercase tracking-wider font-semibold">Avg Vol</span>
            </div>
            <span className="text-base font-mono text-foreground">{formatVolume(avgVolume)}</span>
          </div>
        </div>

        {/* Sub-score bar (only shown when tie-breaking was applied) */}
        {isTied && (
          <div className="mb-4 p-3 rounded-xl bg-primary/5 border border-primary/20">
            <div className="flex items-center gap-2 mb-2">
              <Zap size={13} className="text-primary" />
              <span className="text-[11px] font-mono uppercase tracking-wider text-primary">Tie-Break Sub-Score</span>
              <span className="ml-auto text-[11px] font-mono font-bold text-primary">{subScore}/10</span>
            </div>
            <div className="w-full h-1.5 bg-black/40 rounded-full overflow-hidden border border-white/5">
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: `${(subScore / 10) * 100}%` }}
                transition={{ duration: 0.8, delay: 0.4 + index * 0.1 }}
                className="h-full rounded-full bg-primary"
              />
            </div>
          </div>
        )}
      </div>

      {/* Explanation & Risk Guidance */}
      <div className="relative z-10 flex flex-col gap-3 mt-auto pt-5 border-t border-white/10">
        <div className="flex items-start gap-3">
          <Info size={15} className="mt-0.5 text-muted-foreground shrink-0" />
          <p className="text-sm text-foreground/80 leading-relaxed">{explanation}</p>
        </div>

        <div className={cn('flex items-start gap-3 p-3 rounded-lg border', colors.bg, colors.border)}>
          <ShieldAlert size={15} className={cn('mt-0.5 shrink-0', colors.text)} />
          <p className="text-sm font-medium text-foreground/90 leading-relaxed">{riskGuidance}</p>
        </div>
      </div>
    </motion.div>
  );
};
