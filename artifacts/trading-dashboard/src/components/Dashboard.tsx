import React, { useState, useCallback, useEffect } from 'react';
import {
  useGetMarketScores,
  getGetMarketScoresQueryKey,
  InstrumentConfig,
} from '@workspace/api-client-react';
import { format } from 'date-fns';
import { RefreshCw, ActivitySquare, AlertTriangle, Terminal, Settings2 } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { InstrumentCard } from './InstrumentCard';
import { BestInstrumentHighlight } from './BestInstrumentHighlight';
import { ManageInstrumentsModal } from './ManageInstrumentsModal';
import { cn } from '../lib/utils';

const STORAGE_KEY = 'envScore_instruments';

const DEFAULT_INSTRUMENTS: InstrumentConfig[] = [
  { name: 'BTCUSD', displayTicker: 'BTC-USD',  polyTicker: 'X:BTCUSD' },
  { name: 'XAUUSD', displayTicker: 'GC=F',     polyTicker: 'C:XAUUSD' },
  { name: 'EURUSD', displayTicker: 'EURUSD=X', polyTicker: 'C:EURUSD' },
];

function loadInstruments(): InstrumentConfig[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_INSTRUMENTS;
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed) && parsed.length > 0) return parsed;
  } catch {
    /* ignore parse errors */
  }
  return DEFAULT_INSTRUMENTS;
}

function saveInstruments(instruments: InstrumentConfig[]) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(instruments));
  } catch {
    /* ignore storage errors */
  }
}

export const Dashboard: React.FC = () => {
  const [instruments, setInstruments] = useState<InstrumentConfig[]>(loadInstruments);
  const [modalOpen, setModalOpen] = useState(false);

  const instrumentsJson = JSON.stringify(instruments);

  const { data, isLoading, isError, error, isRefetching, refetch } = useGetMarketScores(
    { instruments: instrumentsJson },
    {
      query: {
        queryKey: getGetMarketScoresQueryKey({ instruments: instrumentsJson }),
        refetchInterval: 60000,
        staleTime: 30000,
      },
    },
  );

  const handleInstrumentsChange = useCallback((next: InstrumentConfig[]) => {
    setInstruments(next);
    saveInstruments(next);
  }, []);

  // Refetch whenever the instrument list changes
  useEffect(() => {
    refetch();
  }, [instrumentsJson]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleRefresh = () => refetch();

  return (
    <div className="min-h-screen bg-background text-foreground p-4 sm:p-6 lg:p-8 font-sans selection:bg-primary/30">
      <div className="max-w-7xl mx-auto space-y-8">

        {/* Header */}
        <header className="flex flex-col sm:flex-row sm:items-end justify-between gap-6 pb-6 border-b border-white/10">
          <div className="space-y-2">
            <div className="flex items-center gap-3">
              <Terminal className="text-primary" size={28} />
              <h1 className="text-3xl sm:text-4xl font-display font-bold tracking-tight text-foreground">
                Env Score<span className="text-primary">.</span>
              </h1>
            </div>
            <p className="text-muted-foreground max-w-xl">
              Algorithmic environment scoring based on ATR and ADX vectors. Quantify market regimes before allocating risk.
            </p>
          </div>

          <div className="flex items-center gap-3 flex-wrap">
            {/* Manage instruments button */}
            <button
              onClick={() => setModalOpen(true)}
              className={cn(
                'flex items-center gap-2 px-4 py-2 rounded-lg font-medium text-sm transition-all duration-200',
                'bg-white/5 hover:bg-white/10 text-muted-foreground hover:text-foreground border border-white/10',
                'focus:outline-none focus:ring-2 focus:ring-primary/50',
              )}
            >
              <Settings2 size={16} />
              <span>Instruments</span>
              <span className="ml-0.5 text-xs font-mono bg-white/10 px-1.5 py-0.5 rounded">
                {instruments.length}
              </span>
            </button>

            {/* Live data + refresh */}
            <div className="flex items-center gap-4 bg-black/40 p-2 pl-4 rounded-xl border border-white/5 backdrop-blur-md">
              <div className="flex items-center gap-2 mr-2">
                <div className="w-2 h-2 rounded-full bg-success animate-pulse-dot" />
                <span className="text-xs font-mono uppercase tracking-wider text-muted-foreground">Live Data</span>
              </div>

              {data?.lastUpdated && (
                <div className="hidden sm:block text-xs font-mono text-muted-foreground pr-4 border-r border-white/10">
                  {format(new Date(data.lastUpdated), 'HH:mm:ss')}
                </div>
              )}

              <button
                onClick={handleRefresh}
                disabled={isLoading || isRefetching}
                className={cn(
                  'flex items-center gap-2 px-4 py-2 rounded-lg font-medium text-sm transition-all duration-200',
                  'bg-white/10 hover:bg-white/20 text-foreground shadow-sm',
                  'disabled:opacity-50 disabled:cursor-not-allowed',
                  'focus:outline-none focus:ring-2 focus:ring-primary/50',
                )}
              >
                <RefreshCw size={16} className={cn((isLoading || isRefetching) && 'animate-spin')} />
                <span>Refresh</span>
              </button>
            </div>
          </div>
        </header>

        {/* Main Content */}
        <main className="space-y-8">

          {/* System Logic Banner */}
          <div className="bg-gradient-to-r from-slate-900 to-black border border-white/10 rounded-xl p-4 flex items-center gap-4">
            <div className="bg-primary/20 p-2 rounded-lg text-primary">
              <ActivitySquare size={20} />
            </div>
            <p className="text-sm text-muted-foreground">
              <strong className="text-foreground font-semibold">System Logic:</strong> Higher score = more risk capacity.
              <span className="mx-2 opacity-50">|</span>
              <span className="text-success inline-flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-success" /> &gt; 70 High Conviction</span>
              <span className="mx-2 opacity-50">|</span>
              <span className="text-warning inline-flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-warning" /> 40–69 Caution</span>
              <span className="mx-2 opacity-50">|</span>
              <span className="text-destructive inline-flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-destructive" /> &lt; 40 Capital Pres.</span>
            </p>
          </div>

          <AnimatePresence mode="wait">
            {isLoading && !data ? (
              <motion.div
                key="loading"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="py-24 flex flex-col items-center justify-center gap-4"
              >
                <div className="w-12 h-12 border-4 border-primary/20 border-t-primary rounded-full animate-spin" />
                <p className="text-muted-foreground font-mono text-sm animate-pulse">Computing vectors...</p>
              </motion.div>
            ) : isError ? (
              <motion.div
                key="error"
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                className="bg-destructive/10 border border-destructive/20 rounded-2xl p-8 flex flex-col items-center justify-center text-center gap-4"
              >
                <AlertTriangle className="text-destructive" size={48} />
                <div>
                  <h3 className="text-xl font-display font-bold text-foreground mb-2">Feed Interrupted</h3>
                  <p className="text-muted-foreground max-w-md mx-auto">
                    {error?.message || 'Unable to retrieve market data. Check your connection or try again.'}
                  </p>
                </div>
                <button
                  onClick={handleRefresh}
                  className="mt-4 px-6 py-2 bg-destructive text-destructive-foreground font-semibold rounded-lg hover:bg-destructive/90 transition-colors"
                >
                  Retry Connection
                </button>
              </motion.div>
            ) : data ? (
              <motion.div
                key="content"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="space-y-8"
              >
                <BestInstrumentHighlight
                  bestInstrument={data.bestInstrument}
                  bestScore={data.bestScore}
                  instruments={data.instruments}
                />

                <div className={cn(
                  'grid gap-6',
                  data.instruments.length === 1 && 'grid-cols-1 max-w-md',
                  data.instruments.length === 2 && 'grid-cols-1 sm:grid-cols-2',
                  data.instruments.length >= 3 && 'grid-cols-1 md:grid-cols-2 lg:grid-cols-3',
                )}>
                  {data.instruments.map((instrument, idx) => (
                    <InstrumentCard
                      key={instrument.ticker}
                      instrument={instrument}
                      index={idx}
                    />
                  ))}
                </div>
              </motion.div>
            ) : null}
          </AnimatePresence>
        </main>

        {/* Footer */}
        <footer className="pt-12 pb-6 flex items-center justify-between text-xs font-mono text-muted-foreground/50 border-t border-white/5">
          <p>QUANT.TRADING_TERMINAL v1.1.0</p>
          <p>STATUS: OPERATIONAL</p>
        </footer>
      </div>

      {/* Manage Instruments Slide-Over */}
      <ManageInstrumentsModal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        instruments={instruments}
        onChange={handleInstrumentsChange}
      />
    </div>
  );
};
