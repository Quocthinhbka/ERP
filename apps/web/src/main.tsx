import { StrictMode, Suspense } from 'react';
import { createRoot } from 'react-dom/client';
import { QueryClientProvider } from '@tanstack/react-query';
import { ConfigProvider } from 'antd';
import viVN from 'antd/locale/vi_VN';
import App from './App';
import { PageSpinner } from './components/PageSpinner';
import { queryClient } from './lib/queryClient';
import './index.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <ConfigProvider locale={viVN}>
        <Suspense fallback={<PageSpinner />}>
          <App />
        </Suspense>
      </ConfigProvider>
    </QueryClientProvider>
  </StrictMode>,
);
