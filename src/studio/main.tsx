import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { startBackdrop } from '../ui/backdrop';
import { applyTheme } from '../ui/theme';
import { Studio } from './Studio';

applyTheme();
startBackdrop();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Studio />
  </StrictMode>,
);
