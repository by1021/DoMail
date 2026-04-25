import React, { useEffect, useState } from 'react';
import { App as AntdApp, Alert, Button, Card, Form, Input, Space, Spin, Typography } from 'antd';
import { LockOutlined, ThunderboltOutlined, UserOutlined } from '@ant-design/icons';
import App from './App.jsx';
import {
  AUTH_EXPIRED_EVENT,
  extractErrorMessage,
  getAdminSession,
  isUnauthorizedError,
  loginAdmin,
  logoutAdmin,
  resetAuthExpiredFlag,
} from './api.js';

const { Title, Text } = Typography;

function LoginPage({ loading, submitting, errorMessage, onSubmit }) {
  const [form] = Form.useForm();

  return (
    <div className="auth-shell auth-shell-responsive">
      <div className="auth-shell-background" />
      <div className="auth-shell-content auth-shell-content-responsive">
        <Card className="auth-card auth-card-responsive">
          <Space direction="vertical" size={20} style={{ width: '100%' }} className="auth-card-stack">
            <div className="auth-hero auth-hero-compact auth-hero-responsive">
              <div className="auth-logo">
                <ThunderboltOutlined />
              </div>
              <div className="auth-title-block auth-title-block-responsive">
                <Text type="secondary" className="section-eyebrow">
                  DoMail
                </Text>
                <Title level={3} style={{ margin: 0 }}>
                  域名邮箱登录
                </Title>
              </div>
            </div>

            {errorMessage ? (
              <Alert
                type="error"
                showIcon
                message="登录失败"
                description={errorMessage}
                className="auth-alert"
              />
            ) : null}

            <div className="auth-form-shell auth-form-shell-responsive">
              <Space direction="vertical" size={12} style={{ width: '100%' }} className="auth-form-stack">
                <Spin spinning={loading}>
                  <Form
                    form={form}
                    layout="vertical"
                    className="auth-form auth-form-responsive"
                    onFinish={onSubmit}
                    initialValues={{
                      username: '',
                      password: '',
                    }}
                  >
                    <Form.Item
                      label="账号"
                      name="username"
                      rules={[{ required: true, message: '请输入账号' }]}
                    >
                      <Input
                        prefix={<UserOutlined />}
                        placeholder="请输入账号"
                        autoComplete="username"
                        size="large"
                      />
                    </Form.Item>

                    <Form.Item
                      label="密码"
                      name="password"
                      rules={[{ required: true, message: '请输入密码' }]}
                    >
                      <Input.Password
                        prefix={<LockOutlined />}
                        placeholder="请输入密码"
                        autoComplete="current-password"
                        size="large"
                      />
                    </Form.Item>

                    <Form.Item style={{ marginBottom: 0 }}>
                      <Button type="primary" htmlType="submit" loading={submitting} block size="large">
                        进入
                      </Button>
                    </Form.Item>
                  </Form>
                </Spin>
              </Space>
            </div>
          </Space>
        </Card>
      </div>
    </div>
  );
}

export default function AuthApp() {
  const { message } = AntdApp.useApp();
  const [checkingSession, setCheckingSession] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [adminProfile, setAdminProfile] = useState(null);
  const [errorMessage, setErrorMessage] = useState('');

  async function restoreSession() {
    try {
      setCheckingSession(true);
      const response = await getAdminSession();
      setAdminProfile(response.item ?? null);
      setErrorMessage('');
      resetAuthExpiredFlag();
    } catch (error) {
      if (!isUnauthorizedError(error)) {
        setErrorMessage(extractErrorMessage(error, '登录态检查失败'));
      }
      setAdminProfile(null);
    } finally {
      setCheckingSession(false);
    }
  }

  useEffect(() => {
    restoreSession();

    function handleAuthExpired(event) {
      const nextMessage = event?.detail?.message || '登录状态已失效，请重新登录管理账号';
      setAdminProfile(null);
      setErrorMessage(nextMessage);
      setCheckingSession(false);
      resetAuthExpiredFlag();
      message.warning(nextMessage);
    }

    window.addEventListener(AUTH_EXPIRED_EVENT, handleAuthExpired);

    return () => {
      window.removeEventListener(AUTH_EXPIRED_EVENT, handleAuthExpired);
    };
  }, [message]);

  async function handleLogin(values) {
    try {
      setSubmitting(true);
      const response = await loginAdmin({
        username: values.username,
        password: values.password,
      });
      setAdminProfile(response.item ?? null);
      setErrorMessage('');
      resetAuthExpiredFlag();
      message.success('已登录');
    } catch (error) {
      setAdminProfile(null);
      setErrorMessage(extractErrorMessage(error, '登录失败'));
    } finally {
      setSubmitting(false);
    }
  }

  async function handleLogout() {
    try {
      await logoutAdmin();
      resetAuthExpiredFlag();
      message.success('已退出登录');
    } catch (error) {
      message.error(extractErrorMessage(error, '退出登录失败'));
    } finally {
      setAdminProfile(null);
      setErrorMessage('');
    }
  }

  if (checkingSession) {
    return (
      <div className="auth-loading">
        <Spin size="large" />
      </div>
    );
  }

  if (!adminProfile) {
    return (
      <LoginPage
        loading={checkingSession}
        submitting={submitting}
        errorMessage={errorMessage}
        onSubmit={handleLogin}
      />
    );
  }

  return <App adminProfile={adminProfile} onLogout={handleLogout} />;
}