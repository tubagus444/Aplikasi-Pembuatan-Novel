import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';
import { ProjectProvider } from './contexts/ProjectContext';
import { NavigationProvider } from './contexts/NavigationContext';
import { UIProvider } from './contexts/UIContext';
import { ErrorBoundary } from './components/ErrorBoundary';

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
