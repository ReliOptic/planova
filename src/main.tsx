import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';
import { ErrorBoundary } from './components/error-boundary';
import { logger } from './app/dependencies';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorBoundary logger={logger}>
      <App />
    </ErrorBoundary>
  </StrictMode>,
);
