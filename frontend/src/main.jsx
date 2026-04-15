import React from 'react';
import ReactDOM from 'react-dom/client';
import { ConfigProvider, App as AntdApp } from 'antd';
import AuthApp from './AuthApp.jsx';
import './styles.css';

const theme = {
  token: {
    colorPrimary: '#2563eb',
    colorInfo: '#2563eb',
    colorSuccess: '#16a34a',
    colorWarning: '#d97706',
    colorError: '#dc2626',
    colorText: '#0f172a',
    colorTextSecondary: '#475569',
    colorBorder: 'rgba(148, 163, 184, 0.18)',
    colorBorderSecondary: 'rgba(148, 163, 184, 0.12)',
    colorBgBase: '#f4f7fb',
    colorBgContainer: '#ffffff',
    colorBgElevated: '#ffffff',
    colorFillSecondary: 'rgba(241, 245, 249, 0.88)',
    borderRadius: 18,
    borderRadiusSM: 14,
    borderRadiusLG: 24,
    fontSize: 14,
    fontSizeHeading3: 28,
    fontSizeHeading4: 20,
    controlHeight: 42,
    boxShadow: '0 10px 30px rgba(15, 23, 42, 0.06)',
    boxShadowSecondary: '0 22px 60px rgba(15, 23, 42, 0.12)',
  },
  components: {
    Layout: {
      headerBg: 'rgba(255, 255, 255, 0.86)',
      siderBg: 'transparent',
      bodyBg: 'transparent',
    },
    Card: {
      borderRadiusLG: 24,
      headerHeight: 56,
    },
    Button: {
      controlHeight: 42,
      borderRadius: 14,
      fontWeight: 600,
    },
    Input: {
      controlHeight: 42,
      borderRadius: 14,
    },
    Select: {
      controlHeight: 42,
      borderRadius: 14,
    },
    Table: {
      headerBg: '#f8fbff',
      headerBorderRadius: 18,
    },
    Modal: {
      borderRadiusLG: 24,
    },
    Drawer: {
      colorBgElevated: '#ffffff',
    },
  },
};

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <ConfigProvider theme={theme}>
      <AntdApp>
        <AuthApp />
      </AntdApp>
    </ConfigProvider>
  </React.StrictMode>,
);