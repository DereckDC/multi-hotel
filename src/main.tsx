import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';

// Intercept and swallow injected web3 / metamask errors or random network 'Failed to fetch' errors gracefully
if (typeof window !== 'undefined') {
  // Override window.alert to completely prevent browser-blocking dialogs in iframe sandbox environments
  window.alert = (message: string) => {
    const event = new CustomEvent('aura-toast', { detail: { message } });
    window.dispatchEvent(event);
    console.log("Captured blocking alert and converted to custom safe event:", message);
  };

  window.addEventListener('error', (event) => {
    const errorMsg = event.message || '';
    const errorStack = event.error?.stack || '';
    if (
      errorMsg.includes('MetaMask') || 
      errorMsg.includes('ethereum') || 
      errorMsg.includes('Failed to fetch') || 
      errorStack.includes('MetaMask') || 
      errorStack.includes('ethereum') ||
      errorStack.includes('Failed to fetch')
    ) {
      console.warn('⚠️ Injected background connection issue caught & handled gracefully by Roomia PMS framework:', errorMsg);
      event.preventDefault();
      event.stopPropagation();
    }
  }, true);

  window.addEventListener('unhandledrejection', (event) => {
    const reason = event.reason;
    const errorMsg = reason?.message || String(reason || '');
    const errorStack = reason?.stack || '';
    if (
      errorMsg.includes('MetaMask') || 
      errorMsg.includes('ethereum') || 
      errorMsg.includes('Failed to fetch') || 
      errorStack.includes('MetaMask') || 
      errorStack.includes('ethereum') ||
      errorStack.includes('Failed to fetch')
    ) {
      console.warn('⚠️ Under-the-hood background network or mock wallet rejection handled gracefully:', errorMsg);
      event.preventDefault();
      event.stopPropagation();
    }
  }, true);
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);

