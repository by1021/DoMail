import React, { useEffect, useState } from 'react';
import { App as AntdApp, Alert, Button, Card, Form, Input, Space, Spin, Typography } from 'antd';
import { LockOutlined, ThunderboltOutlined, UserOutlined } from '@ant-design/icons';
import App from './App.jsx';
import { extractErrorMessage, getAdminSession, loginAdmin, logoutAdmin } from './api.js';

const { Title, Text } = Typography;

function isUnauthorizedError(error) {
  return error?.response?.status === 401;
}

function LoginPage({ loading, submitting, errorMessage, onSubmit }) {
  const [form] = Form.useForm();

  return (
    <div className="auth-shell">
      <div className="auth-shell-background" />
      <Card className="auth-card">
        <Space direction="vertical" size={20} style={{ width: '100%' }}>
          <Space direction="vertical" size={10} align="center" style={{ width: '100%' }}>
            <div className="auth-logo">
              <ThunderboltOutlined />
            </div>
            <div className="auth-title-block">
              <Title level={3} style={{ margin: 0 }}>
                管理员登录
              </Title>
              <Text type="secondary">登录后即可访问 DoMail 域名邮箱管理后台</Text>
            </div>
          </Space>

          {errorMessage ? (
            <Alert
              type="error"
              showIcon
              message="登录失败"
              description={errorMessage}
              className="auth-alert"
            />
          ) : null}

          <Spin spinning={loading}>
            <Form
              form={form}
              layout="vertical"
              onFinish={onSubmit}
              initialValues={{
                username: '',
                password: '',
              }}
            >
              <Form.Item
                label="管理员账号"
                name="username"
                rules={[{ required: true, message: '请输入管理员账号' }]}
              >
                <Input
                  prefix={<UserOutlined />}
                  placeholder="请输入管理员账号"
                  autoComplete="username"
                  size="large"
                />
              </Form.Item>

              <Form.Item
                label="管理员密码"
                name="password"
                rules={[{ required: true, message: '请输入管理员密码' }]}
              >
                <Input.Password
                  prefix={<LockOutlined />}
                  placeholder="请输入管理员密码"
                  autoComplete="current-password"
                  size="large"
                />
              </Form.Item>

              <Form.Item style={{ marginBottom: 0 }}>
                <Button type="primary" htmlType="submit" loading={submitting} block size="large">
                  登录管理后台
                </Button>
              </Form.Item>
            </Form>
          </Spin>
        </Space>
      </Card>
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
      message.success('已登录管理后台');
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