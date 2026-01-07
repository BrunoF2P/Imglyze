import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { DropZone } from './components/DropZone';
import { BatchAnalysis } from './components/BatchAnalysis';
import { ProcessingView } from './components/ProcessingView';
import { ResultModal } from './components/ResultModal';
import { FileItem, BatchSettings, BatchStats } from './types';
import { Header } from './components/Header';
import { useTranslation } from 'react-i18next';
import { loadSystemTheme } from './lib/theme';
import { getCurrentWindow } from '@tauri-apps/api/window';

type AppState = 'IDLE' | 'ANALYSIS' | 'PROCESSING' | 'COMPLETED';

export function App() {
  const { t } = useTranslation();
  const [state, setState] = useState<AppState>('IDLE');
  const [files, setFiles] = useState<FileItem[]>([]);
  const [settings, setSettings] = useState<BatchSettings>({
    globalPreset: 'WebP 80 (Balanced)',
    advancedMode: false,
    formatPresets: { JPG: 'WebP 80', PNG: 'WebP 90', WebP: 'WebP 80', BMP: 'WebP 80' },
    outputMode: 'ZIP',
    outputZipName: 'images_optimized.zip'
  });

  const [stats, setStats] = useState<BatchStats>({
    totalFiles: 0,
    totalSize: 0,
    optimizedSize: 0,
    formatBreakdown: { JPG: 0, PNG: 0, WebP: 0, BMP: 0 }
  });

  const [progress, setProgress] = useState(0);
  const [isPaused, setIsPaused] = useState(false);

  useEffect(() => {
    loadSystemTheme();

    const win = getCurrentWindow();
    const unlisten = win.onThemeChanged(() => {
      loadSystemTheme();
    });

    return () => {
      unlisten.then(u => u());
    };
  }, []);

  useEffect(() => {
    const updateTitle = async () => {
      const win = getCurrentWindow();
      let title = t('windowTitle.idle');

      if (state === 'ANALYSIS') {
        title = t('windowTitle.analysis', { count: files.length });
      } else if (state === 'PROCESSING') {
        title = t('windowTitle.processing', { progress: Math.floor(progress) });
      } else if (state === 'COMPLETED') {
        title = t('windowTitle.completed');
      }

      try {
        await win.setTitle(title);
      } catch (err) {
        console.error('Failed to set window title:', err);
      }
    };

    updateTitle();
  }, [state, progress, files.length, t]);

  // Mock file selection
  const handleFilesSelected = (selectedFiles: FileList | File[]) => {
    const newFiles: FileItem[] = Array.from(selectedFiles).map((file) => ({
      id: Math.random().toString(36).substr(2, 9),
      name: file.name,
      path: (file as any).path || file.name,
      size: file.size,
      format: (file.name.split('.').pop()?.toUpperCase() as any) || 'JPG',
      status: 'Pending',
      selected: true
    }));

    setFiles(newFiles);

    // Update stats
    const breakdown = { JPG: 0, PNG: 0, WebP: 0, BMP: 0 };
    let totalSize = 0;
    newFiles.forEach(f => {
      if (breakdown[f.format] !== undefined) breakdown[f.format]++;
      totalSize += f.size;
    });

    setStats({
      totalFiles: newFiles.length,
      totalSize,
      optimizedSize: 0,
      formatBreakdown: breakdown
    });

    setState('ANALYSIS');
  };

  const startProcessing = () => {
    setState('PROCESSING');
    setProgress(0);

    // Simulate processing
    let current = 0;
    const interval = setInterval(() => {
      if (isPaused) return;

      current += 2;
      setProgress(current);

      // Update small batch of files to "Done"
      setFiles(prev => {
        const next = [...prev];
        const index = Math.floor((current / 100) * next.length);
        for (let i = 0; i <= index && i < next.length; i++) {
          if (next[i].status === 'Pending') {
            next[i].status = 'Done';
            next[i].optimizedSize = Math.floor(next[i].size * 0.15);
          }
        }
        return next;
      });

      if (current >= 100) {
        clearInterval(interval);
        // Calculate final optimized size for stats
        setStats(prev => ({
          ...prev,
          optimizedSize: Math.floor(prev.totalSize * 0.15)
        }));
        setState('COMPLETED');
      }
    }, 100);
  };

  const triggerImageSelection = () => document.getElementById('global-image-input')?.click();
  const triggerZipSelection = () => document.getElementById('global-zip-input')?.click();
  const triggerFolderSelection = () => console.log('Folder selection not mocked yet');

  return (
    <div className="h-screen flex flex-col bg-background text-text-main selection:bg-primary/30 relative overflow-hidden transition-colors duration-300">

      {/* Hidden Global Inputs */}
      <input id="global-image-input" type="file" multiple accept="image/*" className="hidden" onChange={(e) => e.target.files && handleFilesSelected(e.target.files)} />
      <input id="global-zip-input" type="file" accept=".zip" className="hidden" onChange={(e) => e.target.files && handleFilesSelected(e.target.files)} />

      <Header
        onSelectImages={triggerImageSelection}
        onSelectZip={triggerZipSelection}
        onSelectFolder={triggerFolderSelection}
        onAbout={() => alert('Imglyze v0.1.0 Alpha')}
        showReset={state !== 'IDLE'}
        onReset={() => {
          setState('IDLE');
          setFiles([]);
        }}
      />

      {/* Main Content */}
      <main className="flex-1 overflow-y-auto px-6 relative z-10 custom-scrollbar flex flex-col">
        <div className="max-w-6xl mx-auto w-full flex-1 py-10">
          <AnimatePresence mode="wait">
            {state === 'IDLE' && (
              <motion.div
                key="idle"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.2 }}
                className="h-full flex flex-col justify-center"
              >
                <DropZone
                  onFilesSelected={handleFilesSelected}
                  onSelectImages={triggerImageSelection}
                  onSelectZip={triggerZipSelection}
                  onSelectFolder={triggerFolderSelection}
                />
              </motion.div>
            )}

            {state === 'ANALYSIS' && (
              <motion.div
                key="analysis"
                initial={{ opacity: 0, scale: 0.98 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 1.02 }}
                transition={{ duration: 0.2 }}
              >
                <BatchAnalysis
                  stats={stats}
                  settings={settings}
                  setSettings={setSettings}
                  onStart={startProcessing}
                />
              </motion.div>
            )}

            {state === 'PROCESSING' && (
              <motion.div
                key="processing"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                transition={{ duration: 0.2 }}
              >
                <ProcessingView
                  files={files}
                  overallProgress={progress}
                  stats={stats}
                  isPaused={isPaused}
                  onPauseToggle={() => setIsPaused(!isPaused)}
                  onCancel={() => setState('IDLE')}
                />
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </main>

      <ResultModal
        isOpen={state === 'COMPLETED'}
        onClose={() => setState('IDLE')}
        stats={stats}
        successCount={files.length}
        failedCount={0}
      />
    </div>
  );
}

export default App;
