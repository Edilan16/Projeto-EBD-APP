import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './index.css';
//import './styles.css';
// Altere esta linha:
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import './index.css';

const queryClient = new QueryClient();

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(
  <QueryClientProvider client={queryClient}>
    <App />
  </QueryClientProvider>
);