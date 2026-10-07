import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import '../styles/fonts.css';
import '../styles/tokens.css';
import '../styles/base.css';
import { applyTheme } from '../ui/theme';
import { Studio } from './Studio';

applyTheme();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Studio />
  </StrictMode>,
);
