import React from 'react';
import { motion } from 'framer-motion';
import { Trophy, Zap } from 'lucide-react';
import { InstrumentScore } from '@workspace/api-client-react';
import { cn } from '../lib/utils';

interface BestInstrumentHighlightProps {
  bestInstrument: string;
  bestScore: number;
  instruments: InstrumentScore[];
}

export const BestInstrumentHighlight: React.FC<BestInstrumentHighlightProps> = ({
  bestInstrument,
  bestScore,
  instruments,
}) => {
  const best = instruments.find(i => i.name === bestInstrument);
  const tiedInstruments = instruments.filter(i => i.rawScore >= 100);
  const wasTiebroken = tiedInstruments.length > 1;

  return (
    <motion.div
      initial={{ opacity: 0, y: -20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, ease: 'easeOut' }}
      className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-primary/10 via-primary/5 to-transparent border border-primary/20 p-6 sm:p-8"
    >
      <div className="absolute top-0 right-0 p-8 opacity-10 pointer-events-none">
        <Trophy size={120} />
      </div>

      <div className="relative z-10 flex flex-col sm:flex-row sm:items-center justify-between gap-6">
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-2">
            <Trophy className="text-yellow-400" size={20} />
            <h2 className="text-sm font-semibold uppercase tracking-widest text-primary">
              Top Recommendation — Run This in the Algo
            </h2>
          </div>

          <p className="text-3xl sm:text-4xl font-display font-bold text-foreground">
            {bestInstrument}
          </p>

          {wasTiebroken ? (
            <div className="mt-3 flex flex-col gap-1.5">
              <div className="flex items-center gap-2">
                <Zap size={14} className="text-primary" />
                <p className="text-sm text-muted-foreground">
                  <span className="text-foreground font-medium">Tie detected</span> — {tiedInstruments.length} instruments reached 100.
                  Winner selected via tie-breaker sub-score.
                </p>
              </div>
              <div className="flex flex-wrap gap-2 mt-1">
                {tiedInstruments.map(inst => (
                  <div
                    key={inst.name}
                    className={cn(
                      'flex items-center gap-1.5 px-2.5 py-1 rounded-lg border text-xs font-mono',
                      inst.name === bestInstrument
                        ? 'bg-primary/20 border-primary/40 text-primary'
                        : 'bg-white/5 border-white/10 text-muted-foreground',
                    )}
                  >
                    <span className="font-bold">{inst.name}</span>
                    <span className="opacity-60">sub {inst.subScore}/10</span>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <p className="text-muted-foreground mt-2 max-w-md">
              Currently exhibiting the strongest trend environment. Focus capital allocation here.
            </p>
          )}
        </div>

        <div className="flex flex-col items-end shrink-0">
          <span className="text-xs font-mono uppercase tracking-widest text-muted-foreground mb-1">Peak Score</span>
          <div className="text-5xl sm:text-6xl font-display font-bold text-transparent bg-clip-text bg-gradient-to-br from-white to-white/50">
            {bestScore}
          </div>
          {best && best.subScore > 0 && (
            <span className="text-xs font-mono text-primary mt-1">
              +{best.subScore}/10 sub-score
            </span>
          )}
        </div>
      </div>
    </motion.div>
  );
};
