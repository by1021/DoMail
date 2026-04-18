import React, { useEffect, useState } from 'react';
import { App as AntdApp, Alert, Button, Card, Form, Input, Space, Spin, Typography } from 'antd';
import { LockOutlined, ThunderboltOutlined, UserOutlined } from '@ant-design/icons';
import App from './App.jsx';
import {
  extractErrorMessage,
  getAdminSession,
  isUnauthorizedError,
  loginAdmin,
  logoutAdmin,
} from './api.js';

const { Title, Text } = Typography;

function LoginPage({ loading, submitting, errorMessage, onSubmit }) {
  const [form] = Form.useForm();

  return (
    <div className="auth-shell">
      <div className="auth-shell-background" />
      <div className="auth-shell-content">
        <Card className="auth-card">
          <Space direction="vertical" size={24} style={{ width: '100%' }}>
            <div className="auth-hero">
              <div className="auth-logo">
                <ThunderboltOutlined />
              </div>
              <div className="auth-title-block">
                <Text type="secondary" className="section-eyebrow">
                  DoMail
                </Text>
                <Title level={3} style={{ margin: 0 }}>
                  登录
                </Title>
                <Text type="secondary" className="auth-subtitle">
                  输入账号和密码后进入域名邮箱界面。
                </Text>
              </div>
            </div>

            <div className="auth-feature-list">
              <div className="auth-feature-item">
                <Text strong>域名与邮箱</Text>
                <Text type="secondary">集中查看和处理收件相关内容。</Text>
              </div>
              <div className="auth-feature-item">
                <Text strong>安全登录</Text>
                <Text type="secondary">登录后可刷新数据并退出。</Text>
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

            <div className="auth-form-shell">
              <Space direction="vertical" size={14} style={{ width: '100%' }}>
                <Text type="secondary" className="auth-form-caption">
                  请使用账号登录。
                </Text>

                <Spin spinning={loading}>
                  <Form
                    form={form}
                    layout="vertical"
                    className="auth-form"
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
  }, []);

  async function handleLogin(values) {
    try {
      setSubmitting(true);
      const response = await loginAdmin({
        username: values.username,
        password: values.password,
      });
      setAdminProfile(response.item ?? null);
      setErrorMessage('');
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