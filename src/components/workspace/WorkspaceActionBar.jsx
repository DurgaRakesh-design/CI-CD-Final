import React from 'react';
import { RotateCcw } from 'lucide-react';
import { Button } from '@/components/ui/button';

export default function WorkspaceActionBar({ left = null, right = null, onReset = null, className = '' }) {
  return (
    <div className={`fixed bottom-4 left-1/2 z-40 flex w-[calc(100%-2rem)] max-w-7xl -translate-x-1/2 items-center justify-between gap-3 rounded-2xl border border-white/70 bg-white/72 p-3 shadow-[0_24px_70px_rgba(15,23,42,0.24)] ring-1 ring-slate-900/5 backdrop-blur-3xl backdrop-saturate-150 supports-[backdrop-filter]:bg-white/58 ${className}`}>
      <div className="flex min-w-0 items-center gap-2">{left}</div>
      <div className="flex min-w-0 items-center justify-end gap-2">
        {onReset && (
          <Button variant="outline" onClick={onReset} className="rounded-xl h-11 px-5 bg-white/70 shadow-sm backdrop-blur-xl">
            <RotateCcw className="w-4 h-4 mr-2" />
            Reset
          </Button>
        )}
        {right}
      </div>
    </div>
  );
}
