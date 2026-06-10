import React from 'react';
import { RotateCcw } from 'lucide-react';
import { Button } from '@/components/ui/button';

export default function WorkspaceActionBar({ left = null, right = null, onReset = null, className = '' }) {
  return (
    <div className={`fixed bottom-4 left-1/2 z-40 flex w-[calc(100%-2rem)] max-w-7xl -translate-x-1/2 items-center justify-between gap-3 rounded-2xl border border-white/60 bg-white/65 p-3 shadow-2xl shadow-slate-900/12 backdrop-blur-2xl backdrop-saturate-150 supports-[backdrop-filter]:bg-white/55 ${className}`}>
      <div className="flex min-w-0 items-center gap-2">{left}</div>
      <div className="flex min-w-0 items-center justify-end gap-2">
        {onReset && (
          <Button variant="outline" onClick={onReset} className="rounded-xl h-11 px-5">
            <RotateCcw className="w-4 h-4 mr-2" />
            Reset
          </Button>
        )}
        {right}
      </div>
    </div>
  );
}
