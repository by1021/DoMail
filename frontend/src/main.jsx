import React from 'react';
import ReactDOM from 'react-dom/client';
import { ConfigProvider, App as AntdApp } from 'antd';
import App from './App.jsx';
import './styles.css';

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <ConfigProvider
      theme={{
        token: {
          colorPrimary: '#2563eb',
          colorInfo: '#2563eb',
          borderRadius: 16,
          borderRadiusLG: 20,
          boxShadowSecondary: '0 20px 48px rgba(15, 23, 42, 0.12)',
          colorBgElevated: '#ffffff',
        },
      }}
    >
      <AntdApp>
        <App />
      </AntdApp>
    </ConfigProvider>
  </React.StrictMode>,
);