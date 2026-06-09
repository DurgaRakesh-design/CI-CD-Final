import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { Upload, FolderOpen, Package, ArrowRight, FileArchive, CheckCircle2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';

export default function PackageSourceStep({ onNext, onData }) {
  const [source, setSource] = useState(null);
  const [fileName, setFileName] = useState('');
  const [selectedRepo, setSelectedRepo] = useState('');

  const repos = [
    { name: 'payment-service', version: '2.4.1', branch: 'main' },
    { name: 'user-management-api', version: '1.8.0', branch: 'develop' },
    { name: 'inventory-module', version: '3.1.2', branch: 'release/3.1' },
  ];

  const handleFileSelect = (e) => {
    const file = e.target.files?.[0];
    if (file) {
      setFileName(file.name);
      setSource('upload');
    }
  };

  const handleProceed = () => {
    const pkg = source === 'upload'
      ? { name: fileName.replace('.zip', ''), source: 'upload' }
      : repos.find(r => r.name === selectedRepo);
    onData({
      package_source: source,
      package_name: pkg?.name || fileName,
      branch: pkg?.branch || 'main',
      version: pkg?.version || '1.0.0',
    });
    onNext();
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="max-w-2xl mx-auto space-y-6"
    >
      <div className="text-center mb-8">
        <h2 className="font-heading font-bold text-2xl">Select Package Source</h2>
        <p className="text-muted-foreground mt-2">Upload a Java package or select from existing repositories</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {/* Fresh Upload */}
        <Card
          className={`p-6 cursor-pointer transition-all hover:shadow-md ${
            source === 'upload' ? 'border-primary ring-2 ring-primary/20 bg-accent' : 'hover:border-primary/30'
          }`}
          onClick={() => setSource('upload')}
        >
          <div className="flex flex-col items-center text-center gap-3">
            <div className="w-14 h-14 rounded-2xl bg-violet-50 flex items-center justify-center">
              <Upload className="w-6 h-6 text-violet-600" />
            </div>
            <div>
              <h3 className="font-semibold text-sm">Fresh Upload</h3>
              <p className="text-xs text-muted-foreground mt-1">Upload ZIP Java Package</p>
            </div>
          </div>
        </Card>

        {/* From Repository */}
        <Card
          className={`p-6 cursor-pointer transition-all hover:shadow-md ${
            source === 'repository' ? 'border-primary ring-2 ring-primary/20 bg-accent' : 'hover:border-primary/30'
          }`}
          onClick={() => setSource('repository')}
        >
          <div className="flex flex-col items-center text-center gap-3">
            <div className="w-14 h-14 rounded-2xl bg-blue-50 flex items-center justify-center">
              <FolderOpen className="w-6 h-6 text-blue-600" />
            </div>
            <div>
              <h3 className="font-semibold text-sm">From Repository</h3>
              <p className="text-xs text-muted-foreground mt-1">Select existing package</p>
            </div>
          </div>
        </Card>
      </div>

      {/* Upload area */}
      {source === 'upload' && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-4">
          <label className="flex flex-col items-center gap-3 p-8 rounded-2xl border-2 border-dashed border-primary/30 bg-accent/50 cursor-pointer hover:bg-accent transition-colors">
            <FileArchive className="w-8 h-8 text-primary/60" />
            <div className="text-center">
              <p className="text-sm font-medium">{fileName || 'Drop your ZIP file here'}</p>
              <p className="text-xs text-muted-foreground mt-1">Java packages (.zip, .jar)</p>
            </div>
            {fileName && <CheckCircle2 className="w-5 h-5 text-emerald-500" />}
            <input type="file" accept=".zip,.jar" className="hidden" onChange={handleFileSelect} />
          </label>
        </motion.div>
      )}

      {/* Repository selection */}
      {source === 'repository' && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-3">
          {repos.map((repo) => (
            <Card
              key={repo.name}
              className={`p-4 cursor-pointer transition-all ${
                selectedRepo === repo.name ? 'border-primary bg-accent' : 'hover:border-primary/30'
              }`}
              onClick={() => setSelectedRepo(repo.name)}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Package className="w-5 h-5 text-muted-foreground" />
                  <div>
                    <p className="font-medium text-sm">{repo.name}</p>
                    <p className="text-xs text-muted-foreground">v{repo.version} · {repo.branch}</p>
                  </div>
                </div>
                {selectedRepo === repo.name && <CheckCircle2 className="w-5 h-5 text-primary" />}
              </div>
            </Card>
          ))}
        </motion.div>
      )}

      <div className="flex justify-end pt-4">
        <Button
          onClick={handleProceed}
          disabled={!source || (source === 'upload' && !fileName) || (source === 'repository' && !selectedRepo)}
          className="rounded-xl h-11 px-6"
        >
          Continue
          <ArrowRight className="w-4 h-4 ml-2" />
        </Button>
      </div>
    </motion.div>
  );
}
