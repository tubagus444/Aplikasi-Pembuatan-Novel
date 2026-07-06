import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from '@/src/App.tsx';
import './index.css';
import { ProjectProvider } from '@/src/contexts/ProjectContext';
import { NavigationProvider } from '@/src/contexts/NavigationContext';
import { UIProvider } from '@/src/contexts/UIContext';
import { BackupProvider } from '@/src/hooks/useAutoBackup';
import { ToastProvider } from '@/src/hooks/useToast';
import { ToastContainer } from '@/src/components/common/Toast';
import { ErrorBoundary } from '@/src/components/common/ErrorBoundary';
import { ErrorService } from '@/src/services/errorService';
import { oramaSync } from '@/src/services/rag/oramaSync';

// Initialize the sync hooks for RAG DB
oramaSync.setupHooks();

// Global error handlers
window.addEventListener('error', (event) => {
  ErrorService.log({
    message: event.message,
    source: 'Global (window.error)',
    stack: event.error?.stack,
    metadata: { filename: event.filename, lineno: event.lineno, colno: event.colno }
  });
});

window.addEventListener('unhandledrejection', (event) => {
  ErrorService.log({
    message: event.reason?.message || String(event.reason),
    source: 'Global (unhandledrejection)',
    stack: event.reason?.stack,
    metadata: { reason: event.reason }
  });
});

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ProjectProvider>
      <NavigationProvider>
        <UIProvider>
          <ToastProvider>
            {/* Di luar ErrorBoundary agar toast (mis. peringatan DB) tetap tampil
                walau App crash render / masih di layar loading. */}
            <ToastContainer />
            <BackupProvider>
              <ErrorBoundary>
                <App />
              </ErrorBoundary>
            </BackupProvider>
          </ToastProvider>
        </UIProvider>
      </NavigationProvider>
    </ProjectProvider>
  </StrictMode>,
);
