import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Plus, Trash2, ChevronDown, ChevronUp } from 'lucide-react';
import { InstrumentConfig } from '@workspace/api-client-react';
import { cn } from '../lib/utils';

interface ManageInstrumentsModalProps {
  isOpen: boolean;
  onClose: () => void;
  instruments: InstrumentConfig[];
  onChange: (instruments: InstrumentConfig[]) => void;
}

interface PresetGroup {
  label: string;
  items: InstrumentConfig[];
}

const PRESET_GROUPS: PresetGroup[] = [
  {
    label: 'Crypto',
    items: [
      { name: 'ETHUSD',  displayTicker: 'ETH-USD',  polyTicker: 'X:ETHUSD'  },
      { name: 'SOLUSD',  displayTicker: 'SOL-USD',  polyTicker: 'X:SOLUSD'  },
      { name: 'XRPUSD',  displayTicker: 'XRP-USD',  polyTicker: 'X:XRPUSD'  },
      { name: 'BNBUSD',  displayTicker: 'BNB-USD',  polyTicker: 'X:BNBUSD'  },
      { name: 'AVAXUSD', displayTicker: 'AVAX-USD', polyTicker: 'X:AVAXUSD' },
      { name: 'DOTUSD',  displayTicker: 'DOT-USD',  polyTicker: 'X:DOTUSD'  },
      { name: 'ADAUSD',  displayTicker: 'ADA-USD',  polyTicker: 'X:ADAUSD'  },
    ],
  },
  {
    label: 'Forex',
    items: [
      { name: 'GBPUSD', displayTicker: 'GBP-USD', polyTicker: 'C:GBPUSD' },
      { name: 'USDJPY', displayTicker: 'USD-JPY', polyTicker: 'C:USDJPY' },
      { name: 'AUDUSD', displayTicker: 'AUD-USD', polyTicker: 'C:AUDUSD' },
      { name: 'NZDUSD', displayTicker: 'NZD-USD', polyTicker: 'C:NZDUSD' },
      { name: 'USDCAD', displayTicker: 'USD-CAD', polyTicker: 'C:USDCAD' },
      { name: 'USDCHF', displayTicker: 'USD-CHF', polyTicker: 'C:USDCHF' },
      { name: 'EURGBP', displayTicker: 'EUR-GBP', polyTicker: 'C:EURGBP' },
    ],
  },
  {
    label: 'Commodities',
    items: [
      { name: 'XAGUSD', displayTicker: 'XAG-USD', polyTicker: 'C:XAGUSD' },
      { name: 'XPTUSD', displayTicker: 'XPT-USD', polyTicker: 'C:XPTUSD' },
    ],
  },
];

const EMPTY_FORM: InstrumentConfig = { name: '', displayTicker: '', polyTicker: '' };

export const ManageInstrumentsModal: React.FC<ManageInstrumentsModalProps> = ({
  isOpen,
  onClose,
  instruments,
  onChange,
}) => {
  const [form, setForm] = useState<InstrumentConfig>(EMPTY_FORM);
  const [formError, setFormError] = useState('');
  const [expandedGroup, setExpandedGroup] = useState<string | null>('Crypto');

  const activeNames = new Set(instruments.map(i => i.name));

  function addInstrument(inst: InstrumentConfig) {
    if (activeNames.has(inst.name)) return;
    onChange([...instruments, inst]);
  }

  function removeInstrument(name: string) {
    if (instruments.length <= 1) return;
    onChange(instruments.filter(i => i.name !== name));
  }

  function handleFormAdd() {
    const trimmed: InstrumentConfig = {
      name: form.name.trim().toUpperCase(),
      displayTicker: form.displayTicker.trim(),
      polyTicker: form.polyTicker.trim(),
    };

    if (!trimmed.name) { setFormError('Name is required.'); return; }
    if (!trimmed.polyTicker) { setFormError('Polygon ticker is required.'); return; }
    if (activeNames.has(trimmed.name)) { setFormError(`${trimmed.name} is already in your list.`); return; }

    if (!trimmed.displayTicker) trimmed.displayTicker = trimmed.name;

    onChange([...instruments, trimmed]);
    setForm(EMPTY_FORM);
    setFormError('');
  }

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            key="backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-40 bg-black/70 backdrop-blur-sm"
            onClick={onClose}
          />

          {/* Panel */}
          <motion.div
            key="panel"
            initial={{ opacity: 0, x: '100%' }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: '100%' }}
            transition={{ type: 'spring', stiffness: 300, damping: 30 }}
            className="fixed inset-y-0 right-0 z-50 w-full max-w-md flex flex-col bg-[#0d0d0f] border-l border-white/10 shadow-2xl"
          >
            {/* Header */}
            <div className="flex items-center justify-between p-5 border-b border-white/10">
              <div>
                <h2 className="text-lg font-display font-bold text-foreground">Manage Instruments</h2>
                <p className="text-xs text-muted-foreground mt-0.5">Add or remove instruments to score</p>
              </div>
              <button
                onClick={onClose}
                className="p-2 rounded-lg text-muted-foreground hover:text-foreground hover:bg-white/10 transition-colors"
              >
                <X size={18} />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto">

              {/* Active instruments */}
              <div className="p-5 border-b border-white/10">
                <h3 className="text-xs font-mono uppercase tracking-widest text-muted-foreground mb-3">
                  Active ({instruments.length})
                </h3>
                <div className="space-y-2">
                  {instruments.map(inst => (
                    <div
                      key={inst.name}
                      className="flex items-center justify-between p-3 rounded-xl bg-white/5 border border-white/10"
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-2 h-2 rounded-full bg-success" />
                        <div>
                          <p className="text-sm font-semibold text-foreground">{inst.name}</p>
                          <p className="text-xs text-muted-foreground font-mono">{inst.polyTicker}</p>
                        </div>
                      </div>
                      <button
                        onClick={() => removeInstrument(inst.name)}
                        disabled={instruments.length <= 1}
                        title={instruments.length <= 1 ? 'At least one instrument required' : `Remove ${inst.name}`}
                        className={cn(
                          'p-1.5 rounded-lg transition-colors',
                          instruments.length <= 1
                            ? 'text-muted-foreground/30 cursor-not-allowed'
                            : 'text-muted-foreground hover:text-destructive hover:bg-destructive/10',
                        )}
                      >
                        <Trash2 size={15} />
                      </button>
                    </div>
                  ))}
                </div>
              </div>

              {/* Presets */}
              <div className="p-5 border-b border-white/10">
                <h3 className="text-xs font-mono uppercase tracking-widest text-muted-foreground mb-3">
                  Quick Add
                </h3>
                <div className="space-y-2">
                  {PRESET_GROUPS.map(group => {
                    const isExpanded = expandedGroup === group.label;
                    const availableCount = group.items.filter(i => !activeNames.has(i.name)).length;
                    return (
                      <div key={group.label} className="rounded-xl border border-white/10 overflow-hidden">
                        <button
                          onClick={() => setExpandedGroup(isExpanded ? null : group.label)}
                          className="w-full flex items-center justify-between p-3 hover:bg-white/5 transition-colors"
                        >
                          <span className="text-sm font-semibold text-foreground">{group.label}</span>
                          <div className="flex items-center gap-2">
                            {availableCount > 0 && (
                              <span className="text-xs font-mono text-muted-foreground">{availableCount} available</span>
                            )}
                            {isExpanded ? <ChevronUp size={15} className="text-muted-foreground" /> : <ChevronDown size={15} className="text-muted-foreground" />}
                          </div>
                        </button>
                        <AnimatePresence>
                          {isExpanded && (
                            <motion.div
                              initial={{ height: 0 }}
                              animate={{ height: 'auto' }}
                              exit={{ height: 0 }}
                              className="overflow-hidden"
                            >
                              <div className="px-3 pb-3 grid grid-cols-2 gap-2">
                                {group.items.map(preset => {
                                  const active = activeNames.has(preset.name);
                                  return (
                                    <button
                                      key={preset.name}
                                      onClick={() => addInstrument(preset)}
                                      disabled={active}
                                      className={cn(
                                        'flex items-center justify-between p-2.5 rounded-lg border text-left transition-all',
                                        active
                                          ? 'border-success/30 bg-success/10 cursor-not-allowed opacity-60'
                                          : 'border-white/10 bg-white/5 hover:bg-white/10 hover:border-white/20',
                                      )}
                                    >
                                      <div>
                                        <p className="text-xs font-semibold text-foreground">{preset.name}</p>
                                        <p className="text-[10px] text-muted-foreground font-mono">{preset.polyTicker}</p>
                                      </div>
                                      {active
                                        ? <span className="text-[9px] font-mono text-success uppercase">Active</span>
                                        : <Plus size={13} className="text-muted-foreground shrink-0" />
                                      }
                                    </button>
                                  );
                                })}
                              </div>
                            </motion.div>
                          )}
                        </AnimatePresence>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Custom instrument form */}
              <div className="p-5">
                <h3 className="text-xs font-mono uppercase tracking-widest text-muted-foreground mb-3">
                  Custom Instrument
                </h3>
                <div className="space-y-3">
                  <div>
                    <label className="text-xs text-muted-foreground mb-1.5 block">
                      Polygon Ticker <span className="text-destructive">*</span>
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. X:ETHUSD, C:GBPUSD"
                      value={form.polyTicker}
                      onChange={e => setForm(f => ({ ...f, polyTicker: e.target.value }))}
                      className="w-full bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-1 focus:ring-primary/50 focus:border-primary/30 transition-colors font-mono"
                    />
                    <p className="text-[10px] text-muted-foreground/70 mt-1">
                      Prefix: <span className="text-foreground/60 font-mono">X:</span> Crypto · 
                      <span className="text-foreground/60 font-mono"> C:</span> Forex/Commodity
                    </p>
                  </div>
                  <div>
                    <label className="text-xs text-muted-foreground mb-1.5 block">
                      Name <span className="text-destructive">*</span>
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. ETHUSD"
                      value={form.name}
                      onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                      className="w-full bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-1 focus:ring-primary/50 focus:border-primary/30 transition-colors font-mono"
                    />
                  </div>
                  <div>
                    <label className="text-xs text-muted-foreground mb-1.5 block">
                      Display Label <span className="text-muted-foreground/50">(optional)</span>
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. ETH-USD"
                      value={form.displayTicker}
                      onChange={e => setForm(f => ({ ...f, displayTicker: e.target.value }))}
                      className="w-full bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-1 focus:ring-primary/50 focus:border-primary/30 transition-colors font-mono"
                    />
                  </div>

                  {formError && (
                    <p className="text-xs text-destructive">{formError}</p>
                  )}

                  <button
                    onClick={handleFormAdd}
                    className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-primary text-black font-semibold text-sm hover:bg-primary/90 transition-colors"
                  >
                    <Plus size={15} />
                    Add Instrument
                  </button>
                </div>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
};
