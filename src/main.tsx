import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';
import { ProjectProvider } from './contexts/ProjectContext';
import { NavigationProvider } from './contexts/NavigationContext';
import { UIProvider } from './contexts/UIContext';
import { ErrorBoundary } from './components/ErrorBoundary';
import { ErrorService } from './services/errorService';

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
          <ErrorBoundary>
            <App />
          </ErrorBoundary>
        </UIProvider>
      </NavigationProvider>
    </ProjectProvider>
  </StrictMode>,
);
