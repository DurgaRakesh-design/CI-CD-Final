import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Cpu, Check, ArrowRight, ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';

const detectedProps = [
  { label: 'Platform', value: 'Java / Spring Boot', icon: '☕' },
  { label: 'Technology Stack', value: 'Spring Boot 3.2, Maven, JUnit 5, Cucumber', icon: '🛠' },
  { label: 'Branch', value: 'main', icon: '🌿' },
  { label: 'Version', value: '2.4.1', icon: '📦' },
  { label: 'Environment', value: 'Production', icon: '🌐' },
];

export default function PackageDetectionStep({ workspaceData, onNext, onBack, onData }) {
  const [detecting, setDetecting] = useState(true);
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setProgress(p => {
        if (p >= 100) {
          clearInterval(interval);
          setDetecting(false);
          return 100;
        }
        return p + 5;
      });
    }, 80);
    return () => clearInterval(interval);
  }, []);

  const handleProceed = () => {
    onData({
      platform: 'Java / Spring Boot',
      tech_stack: 'Spring Boot 3.2, Maven, JUnit 5, Cucumber',
      environment: 'Production',
    });
    onNext();
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="max-w-xl mx-auto space-y-6"
    >
      <div className="text-center mb-8">
        <h2 className="font-heading font-bold text-2xl">Package Detection</h2>
        <p className="text-muted-foreground mt-2">Analyzing your package structure and metadata</p>
      </div>

      {detecting ? (
        <motion.div className="flex flex-col items-center gap-6 py-10">
          <div className="relative">
            <div className="w-20 h-20 rounded-2xl bg-accent flex items-center justify-center">
              <Cpu className="w-8 h-8 text-primary animate-pulse" />
            </div>
          </div>
          <div className="w-full max-w-xs">
            <div className="h-2 bg-muted rounded-full overflow-hidden">
              <motion.div
                className="h-full bg-primary rounded-full"
                initial={{ width: 0 }}
                animate={{ width: `${progress}%` }}
                transition={{ ease: 'linear' }}
              />
            </div>
            <p className="text-sm text-muted-foreground text-center mt-2">
              Detecting... {progress}%
            </p>
          </div>
        </motion.div>
      ) : (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-3">
          {detectedProps.map((prop, i) => (
            <motion.div
              key={prop.label}
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: i * 0.1 }}
              className="flex items-center justify-between p-4 rounded-xl bg-white border border-border"
            >
              <div className="flex items-center gap-3">
                <span className="text-lg">{prop.icon}</span>
                <span className="text-sm font-medium text-muted-foreground">{prop.label}</span>
              </div>
              <Badge variant="secondary" className="font-mono text-xs">{prop.value}</Badge>
            </motion.div>
          ))}

          <div className="flex items-center gap-2 p-3 rounded-xl bg-emerald-50 text-emerald-700 text-sm">
            <Check className="w-4 h-4" />
            <span className="font-medium">Package analysis complete</span>
          </div>

          <div className="flex items-center justify-between pt-4">
            <Button variant="outline" onClick={onBack} className="rounded-xl h-11 px-5">
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back
            </Button>
            <Button onClick={handleProceed} className="rounded-xl h-11 px-6">
              Continue
              <ArrowRight className="w-4 h-4 ml-2" />
            </Button>
          </div>
        </motion.div>
      )}
    </motion.div>
  );
}
