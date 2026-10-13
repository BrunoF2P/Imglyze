import { Toaster, toast } from 'sonner';
import { useTranslation } from 'react-i18next';
import { useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { DropZone } from './components/ui/DropZone';
import { BatchAnalysis } from './features/batch-processing/components/BatchAnalysis';
import { ProcessingView } from './features/batch-processing/components/ProcessingView';
import { ResultModal } from './features/batch-processing/components/ResultModal';
import { CompareModal } from './features/batch-processing/components/CompareModal';
import { Header } from './components/layouts/Header';
import { ErrorBoundary } from './components/ui/ErrorBoundary';
import { loadSystemTheme } from './lib/theme';
import { getCurrentWindow } from '@tauri-apps/api/window';
import { useBatch } from './contexts/BatchContext';

export function App() {
  const { t } = useTranslation();
  const {
    state,
    setState,
    comparingFile,
    setComparingFile,
    handleFilesSelected,
    triggerFileSelection,
    triggerZipSelection,
    triggerFolderSelection,
    resetBatch
  } = useBatch();

  useEffect(() => {
    loadSystemTheme();
    if (!("__TAURI_INTERNALS__" in window)) return;
    const win = getCurrentWindow();
    const unlisten = win.onThemeChanged(() => {
      loadSystemTheme();
    });
    return () => {
      unlisten.then(u => u());
    };
  }, []);

  return (
    <ErrorBoundary>
      <div className="h-screen flex flex-col bg-background text-text-main selection:bg-primary/30 relative overflow-hidden transition-colors duration-300">
        <Header
          onSelectImages={triggerFileSelection}
          onSelectZip={triggerZipSelection}
          onSelectFolder={triggerFolderSelection}
          onAbout={() => toast.info(t('v1.about'))}
          showReset={state !== 'IDLE' && state !== 'PROCESSING'}
          onReset={resetBatch}
        />

        <main className="flex-1 overflow-y-auto px-6 relative z-10 custom-scrollbar flex flex-col">
          <div className="max-w-[1600px] mx-auto w-full flex-1 py-6">
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
                    onSelectImages={triggerFileSelection}
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
                  <BatchAnalysis />
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
                  <ProcessingView />
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </main>

        <ResultModal isOpen={state === 'COMPLETED'} onClose={() => setState('ANALYSIS')} />

        <CompareModal
          file={comparingFile}
          onClose={() => setComparingFile(null)}
        />
        <Toaster position="bottom-right" richColors />
      </div>
    </ErrorBoundary>
  );
}

export default App;
