import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import PaymentPage from './components/PaymentPage';
import './index.css';
import { initDeepLinks } from './utils/deepLinks';

// En la app Android: abrir dentro de la app los enlaces de roomiapms.site (correos, recuperar contraseña)
initDeepLinks();

// Intercept and swallow injected web3 / metamask errors or random network 'Failed to fetch' errors gracefully
if (typeof window !== 'undefined') {
  // Override window.alert to completely prevent browser-blocking dialogs in iframe sandbox environments
  window.alert = (message: string) => {
    const event = new CustomEvent('aura-toast', { detail: { message } });
    window.dispatchEvent(event);
    console.log("Captured blocking alert and converted to custom safe event:", message);
  };

  const isIgnoredError = (msg: string, stack: string) => {
    const lowerMsg = (msg || '').toLowerCase();
    const lowerStack = (stack || '').toLowerCase();
    return (
      lowerMsg.includes('metamask') || 
      lowerMsg.includes('ethereum') || 
      lowerMsg.includes('web3') || 
      lowerMsg.includes('failed to fetch') || 
      lowerMsg.includes('failed to connect') ||
      lowerStack.includes('metamask') || 
      lowerStack.includes('ethereum') ||
      lowerStack.includes('web3') ||
      lowerStack.includes('failed to fetch')
    );
  };

  window.addEventListener('error', (event) => {
    const errorMsg = event.message || event.error?.message || '';
    const errorStack = event.error?.stack || '';
    if (isIgnoredError(errorMsg, errorStack)) {
      console.warn('⚠️ Extension / background connection issue handled gracefully:', errorMsg);
      event.preventDefault();
      event.stopPropagation();
      if (typeof event.stopImmediatePropagation === 'function') {
        event.stopImmediatePropagation();
      }
    }
  }, true);

  window.addEventListener('unhandledrejection', (event) => {
    const reason = event.reason;
    const errorMsg = reason?.message || String(reason || '');
    const errorStack = reason?.stack || '';
    if (isIgnoredError(errorMsg, errorStack)) {
      console.warn('⚠️ Background network or extension rejection handled gracefully:', errorMsg);
      event.preventDefault();
      event.stopPropagation();
      if (typeof event.stopImmediatePropagation === 'function') {
        event.stopImmediatePropagation();
      }
    }
  }, true);
}

// /pago/... es una página aparte (Cajita de Payphone): no carga la app completa ni pide sesión
const isPaymentRoute = typeof window !== 'undefined' && /^\/pago\/[^/]+\/?$/.test(window.location.pathname);

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    {isPaymentRoute ? <PaymentPage /> : <App />}
  </StrictMode>,
);

