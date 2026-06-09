import React from 'react';
import { Package, FileText, Search, BarChart3, ShieldCheck, GitBranch, Check } from 'lucide-react';

const steps = [
  { icon: Package, label: 'Package Source' },
  { icon: FileText, label: 'Requirements' },
  { icon: Search, label: 'Document Review' },
  { icon: BarChart3, label: 'Gap Analysis' },
  { icon: ShieldCheck, label: 'Approval' },
  { icon: GitBranch, label: 'Trigger Pipeline' },
];

export default function WorkflowStepper({ currentStep, onStepClick }) {
  return (
    <div className="w-full overflow-x-auto pb-2">
      <div className="flex items-center min-w-max px-1">
        {steps.map((step, i) => {
          const isCompleted = i < currentStep;
          const isCurrent = i === currentStep;
          const isUpcoming = i > currentStep;

          return (
            <React.Fragment key={step.label}>
              <button
                onClick={() => i <= currentStep && onStepClick(i)}
                className={`flex items-center gap-2 px-3 py-2 rounded-xl text-sm font-medium transition-all whitespace-nowrap ${
                  isCurrent
                    ? 'bg-primary text-primary-foreground shadow-lg shadow-primary/20'
                    : isCompleted
                    ? 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100 cursor-pointer'
                    : 'bg-muted text-muted-foreground'
                }`}
                disabled={isUpcoming}
              >
                <div className={`w-6 h-6 rounded-md flex items-center justify-center text-xs ${
                  isCurrent
                    ? 'bg-white/20'
                    : isCompleted
                    ? 'bg-emerald-200/50'
                    : 'bg-muted-foreground/10'
                }`}>
                  {isCompleted ? (
                    <Check className="w-3.5 h-3.5" />
                  ) : (
                    <step.icon className="w-3.5 h-3.5" />
                  )}
                </div>
                <span className="hidden sm:inline">{step.label}</span>
              </button>
              {i < steps.length - 1 && (
                <div className={`w-8 h-px mx-1 ${
                  i < currentStep ? 'bg-emerald-300' : 'bg-border'
                }`} />
              )}
            </React.Fragment>
          );
        })}
      </div>
    </div>
  );
}
