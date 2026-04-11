import axios from 'axios';

const api = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL || '/api',
  timeout: 10000,
});

export async function getHealth() {
  const { data } = await api.get('/api/health');
  return data;
}

export async function getDomains() {
  const { data } = await api.get('/api/domains');
  return data;
}

export async function createDomain(payload) {
  const { data } = await api.post('/api/domains', payload);
  return data;
}

export async function getDomainDetail(domainId) {
  const { data } = await api.get(`/api/domains/${domainId}`);
  return data;
}

export async function deleteDomain(id) {
  const { data } = await api.delete(`/api/domains/${id}`);
  return data;
}

export async function getMailboxes() {
  const { data } = await api.get('/api/mailboxes');
  return data;
}

export async function createMailbox(payload) {
  const { data } = await api.post('/api/mailboxes', payload);
  return data;
}

export async function deleteMailbox(id) {
  const { data } = await api.delete(`/api/mailboxes/${id}`);
  return data;
}

export async function getMailboxMessages(mailboxId) {
  const { data } = await api.get(`/api/mailboxes/${mailboxId}/messages`);
  return data;
}

export async function getMessageDetail(messageId) {
  const { data } = await api.get(`/api/messages/${messageId}`);
  return data;
}

export async function markMessageRead(messageId) {
  const { data } = await api.patch(`/api/messages/${messageId}/read`);
  return data;
}

export async function deleteMessage(messageId) {
  const { data } = await api.delete(`/api/messages/${messageId}`);
  return data;
}

export async function updateMailboxRetention(mailboxId, payload) {
  const { data } = await api.patch(`/api/mailboxes/${mailboxId}/retention`, payload);
  return data;
}

export function extractErrorMessage(error, fallback = '请求失败') {
  return (
    error?.response?.data?.error?.message ||
    error?.message ||
    fallback
  );
}