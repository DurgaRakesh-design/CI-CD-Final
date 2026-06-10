import React, { useCallback, useEffect, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { Upload, FolderOpen, Package, ArrowRight, FileArchive, CheckCircle2, RefreshCw, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { listUploadedPackages } from '@/services/pipelineService';
import WorkspaceActionBar from './WorkspaceActionBar';

export default function PackageSourceStep({ workspaceData, onNext, onData, onResetArtifacts }) {
  const [source, setSource] = useState(workspaceData?.package_source || null);
  const [fileName, setFileName] = useState(workspaceData?.package_name || '');
  const [packageFile, setPackageFile] = useState(workspaceData?.package_file || null);
  const [selectedRepo, setSelectedRepo] = useState(workspaceData?.selected_package || null);
  const [repos, setRepos] = useState([]);
  const [loadingRepos, setLoadingRepos] = useState(false);
  const [repoError, setRepoError] = useState('');
  const lastSignatureRef = useRef('');

  const loadRepos = useCallback(async () => {
    setLoadingRepos(true);
    setRepoError('');
    try {
      setRepos(await listUploadedPackages());
    } catch (error) {
      setRepoError(error.message || 'Could not load repository packages.');
    } finally {
      setLoadingRepos(false);
    }
  }, []);

  useEffect(() => {
    if (source === 'repository' && !repos.length && !loadingRepos) loadRepos();
  }, [source, repos.length, loadingRepos, loadRepos]);

  useEffect(() => {
    if (!source) return;
    const signature = `${source}|${source === 'upload' ? fileName : selectedRepo?.path || ''}`;
    if (lastSignatureRef.current && lastSignatureRef.current !== signature) {
      onResetArtifacts?.();
    }
    lastSignatureRef.current = signature;
    const packageName = source === 'upload' ? fileName : selectedRepo?.name || '';
    onData({
      package_source: source,
      package_name: packageName,
      package_file: packageFile,
      selected_package: source === 'repository' ? selectedRepo : null,
      branch: 'develop',
      version: 'unversioned',
    });
  }, [source, fileName, packageFile, selectedRepo, onData]);

  const handleFileSelect = (e) => {
    const file = e.target.files?.[0];
    if (file) {
      setFileName(file.name);
      setPackageFile(file);
      setSource('upload');
    }
  };

  const clearUpload = () => {
    setFileName('');
    setPackageFile(null);
    if (source === 'upload') setSource(null);
    onResetArtifacts?.();
    onData({
      package_source: null,
      package_name: '',
      package_file: null,
      selected_package: null,
      branch: 'develop',
      version: 'unversioned',
    });
  };

  const selectRepositoryMode = () => {
    setSource('repository');
    if (!repos.length && !loadingRepos) loadRepos();
  };

  const clearRepositorySelection = () => {
    setSelectedRepo(null);
    if (source === 'repository') setSource(null);
    onResetArtifacts?.();
    onData({
      package_source: null,
      package_name: '',
      package_file: null,
      selected_package: null,
      branch: 'develop',
      version: 'unversioned',
    });
  };

  const handleProceed = () => {
    onNext();
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="max-w-2xl mx-auto space-y-6 pb-24"
    >
      <div className="text-center mb-8">
        <h2 className="font-heading font-bold text-2xl">Select Package Source</h2>
        <p className="text-muted-foreground mt-2">Upload a Java package or select from existing repository uploads</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
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
              <p className="text-xs text-muted-foreground mt-1">Upload ZIP or JAR Java package</p>
            </div>
          </div>
        </Card>

        <Card
          className={`p-6 cursor-pointer transition-all hover:shadow-md ${
            source === 'repository' ? 'border-primary ring-2 ring-primary/20 bg-accent' : 'hover:border-primary/30'
          }`}
          onClick={selectRepositoryMode}
        >
          <div className="flex flex-col items-center text-center gap-3">
            <div className="w-14 h-14 rounded-2xl bg-blue-50 flex items-center justify-center">
              <FolderOpen className="w-6 h-6 text-blue-600" />
            </div>
            <div>
              <h3 className="font-semibold text-sm">From Repository</h3>
              <p className="text-xs text-muted-foreground mt-1">Select from packages/uploads</p>
            </div>
          </div>
        </Card>
      </div>

      {source === 'upload' && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-4">
          <label className="flex flex-col items-center gap-3 p-8 rounded-2xl border-2 border-dashed border-primary/30 bg-accent/50 cursor-pointer hover:bg-accent transition-colors">
            <FileArchive className="w-8 h-8 text-primary/60" />
            <div className="text-center">
              <p className="text-sm font-medium">{fileName || 'Drop your package here'}</p>
              <p className="text-xs text-muted-foreground mt-1">Supported: .zip, .jar, .war</p>
            </div>
            {fileName && <CheckCircle2 className="w-5 h-5 text-emerald-500" />}
            <input type="file" accept=".zip,.jar,.war" className="hidden" onChange={handleFileSelect} />
          </label>
          {fileName && (
            <div className="flex justify-end">
              <Button type="button" variant="ghost" size="sm" className="h-8 text-xs" onClick={clearUpload}>
                <X className="w-3.5 h-3.5 mr-1.5" />
                Remove package
              </Button>
            </div>
          )}
        </motion.div>
      )}

      {source === 'repository' && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-3">
          <div className="flex justify-end">
            <Button type="button" variant="outline" size="sm" className="rounded-lg h-8 text-xs" onClick={loadRepos} disabled={loadingRepos}>
              <RefreshCw className={`w-3.5 h-3.5 mr-1.5 ${loadingRepos ? 'animate-spin' : ''}`} />
              Refresh
            </Button>
          </div>
          {repoError && <p className="text-xs text-red-600">{repoError}</p>}
          {loadingRepos && <p className="text-xs text-muted-foreground">Loading packages from GitHub...</p>}
          {!loadingRepos && !repoError && repos.length === 0 && (
            <p className="text-xs text-muted-foreground">No deployable package files found in packages/uploads.</p>
          )}
          {repos.map((repo) => (
            <Card
              key={repo.path}
              className={`p-4 cursor-pointer transition-all ${
                selectedRepo?.path === repo.path ? 'border-primary bg-accent' : 'hover:border-primary/30'
              }`}
              onClick={() => setSelectedRepo(repo)}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3 min-w-0">
                  <Package className="w-5 h-5 text-muted-foreground shrink-0" />
                  <div className="min-w-0">
                    <p className="font-medium text-sm truncate">{repo.name}</p>
                    <p className="text-xs text-muted-foreground truncate">{repo.path} - {Math.max(1, Math.round((repo.size || 0) / 1024))} KB</p>
                  </div>
                </div>
                {selectedRepo?.path === repo.path && <CheckCircle2 className="w-5 h-5 text-primary shrink-0" />}
              </div>
            </Card>
          ))}
          {selectedRepo && (
            <div className="flex justify-end">
              <Button type="button" variant="ghost" size="sm" className="h-8 text-xs" onClick={clearRepositorySelection}>
                <X className="w-3.5 h-3.5 mr-1.5" />
                Clear selection
              </Button>
            </div>
          )}
        </motion.div>
      )}

      <WorkspaceActionBar
        right={(
          <Button
            onClick={handleProceed}
            disabled={!source || (source === 'upload' && !packageFile) || (source === 'repository' && !selectedRepo)}
            className="rounded-xl h-11 px-6"
          >
            Continue
            <ArrowRight className="w-4 h-4 ml-2" />
          </Button>
        )}
      />
    </motion.div>
  );
}
