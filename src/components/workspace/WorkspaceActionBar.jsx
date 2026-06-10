import React from 'react';
import { RotateCcw } from 'lucide-react';
import { Button } from '@/components/ui/button';

export default function WorkspaceActionBar({ left = null, right = null, onReset = null, className = '' }) {
  return (
    <div className={`sticky bottom-4 z-10 flex items-center justify-between gap-3 rounded-2xl border border-border bg-white/95 p-3 shadow-lg backdrop-blur ${className}`}>
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
