import axios from 'axios';

const api = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL || '/api',
  timeout: 10000,
  withCredentials: true,
});

export async function loginAdmin(payload) {
  const { data } = await api.post('/auth/login', payload);
  return data;
}

export async function logoutAdmin() {
  const { data } = await api.post('/auth/logout');
  return data;
}

export async function getAdminSession() {
  const { data } = await api.get('/auth/session');
  return data;
}

export async function getHealth() {
  const { data } = await api.get('/health');
  return data;
}

export async function getDomains() {
  const { data } = await api.get('/domains');
  return data;
}

export async function createDomain(payload) {
  const { data } = await api.post('/domains', payload);
  return data;
}

export async function getDomainDetail(domainId) {
  const { data } = await api.get(`/domains/${domainId}`);
  return data;
}

export async function deleteDomain(id) {
  const { data } = await api.delete(`/domains/${id}`);
  return data;
}

export async function detectDomainDns(domainId) {
  const { data } = await api.post(`/domains/${domainId}/detect-dns`);
  return data;
}

export async function getMailboxes() {
  const { data } = await api.get('/mailboxes');
  return data;
}

export async function createMailbox(payload) {
  const { data } = await api.post('/mailboxes', payload);
  return data;
}

export async function deleteMailbox(id) {
  const { data } = await api.delete(`/mailboxes/${id}`);
  return data;
}

export async function getMailboxMessages(mailboxId) {
  const { data } = await api.get(`/mailboxes/${mailboxId}/messages`);
  return data;
}

export async function getMessageDetail(messageId) {
  const { data } = await api.get(`/messages/${messageId}`);
  return data;
}

export async function markMessageRead(messageId) {
  const { data } = await api.patch(`/messages/${messageId}/read`);
  return data;
}

export async function deleteMessage(messageId) {
  const { data } = await api.delete(`/messages/${messageId}`);
  return data;
}

export async function updateMailboxRetention(mailboxId, payload) {
  const { data } = await api.patch(`/mailboxes/${mailboxId}/retention`, payload);
  return data;
}

export function isUnauthorizedError(error) {
  return error?.response?.status === 401;
}

export function extractErrorMessage(error, fallback = '请求失败') {
  return (
    error?.response?.data?.error?.message ||
    error?.message ||
    fallback
  );
}