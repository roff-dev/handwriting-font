import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { applyTheme } from '../ui/theme';
import { Studio } from './Studio';

applyTheme();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Studio />
  </StrictMode>,
);
