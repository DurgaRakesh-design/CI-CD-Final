import React from 'react';

export default function AiLoadingVisual({ title, description, compact = false, className = '' }) {
  return (
    <div className={`flex flex-col items-center justify-center text-center ${className}`}>
      <img
        src="/ai-loading.gif"
        alt="AI loading animation"
        className={compact ? 'w-8 h-8 object-contain' : 'w-28 h-28 object-contain'}
        draggable="false"
      />
      {(title || description) && !compact && (
        <div className="mt-4 space-y-1">
          {title && <p className="font-semibold text-sm text-foreground">{title}</p>}
          {description && <p className="text-xs text-muted-foreground max-w-sm">{description}</p>}
        </div>
      )}
    </div>
  );
}
