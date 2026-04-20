const PREFIX_MODE_CUSTOM = 'custom';
const PREFIX_MODE_RANDOM = 'random';
const DOMAIN_MODE_ROOT = 'root';
const DOMAIN_MODE_CUSTOM_SUBDOMAIN = 'custom-subdomain';
const DOMAIN_MODE_RANDOM_SUBDOMAIN = 'random-subdomain';

function normalizeText(value) {
  return String(value ?? '').trim().toLowerCase();
}

function getPreviewPrefix(prefixMode, localPart) {
  if (prefixMode === PREFIX_MODE_RANDOM) {
    return '随机生成';
  }

  const normalizedLocalPart = normalizeText(localPart);
  return normalizedLocalPart || 'prefix';
}

function getPreviewDomain(domain, domainMode, subdomain) {
  const normalizedDomain = normalizeText(domain);

  if (!normalizedDomain) {
    return '';
  }

  if (domainMode === DOMAIN_MODE_CUSTOM_SUBDOMAIN) {
    const normalizedSubdomain = normalizeText(subdomain) || 'subdomain';
    return `${normalizedSubdomain}.${normalizedDomain}`;
  }

  if (domainMode === DOMAIN_MODE_RANDOM_SUBDOMAIN) {
    return `随机生成.${normalizedDomain}`;
  }

  return normalizedDomain;
}

export function getMailboxCreateInitialValues(overrides = {}) {
  return {
    domain: undefined,
    prefixMode: PREFIX_MODE_CUSTOM,
    localPart: '',
    domainMode: DOMAIN_MODE_ROOT,
    subdomain: '',
    ...overrides,
  };
}

export function buildMailboxPreviewAddress(values = {}) {
  const previewDomain = getPreviewDomain(values.domain, values.domainMode, values.subdomain);

  if (!previewDomain) {
    return '请先选择主域名';
  }

  const previewPrefix = getPreviewPrefix(values.prefixMode, values.localPart);
  return `${previewPrefix}@${previewDomain}`;
}

export function buildMailboxRequestPayload(values = {}) {
  const normalizedDomain = normalizeText(values.domain);
  const normalizedLocalPart = normalizeText(values.localPart);
  const normalizedSubdomain = normalizeText(values.subdomain);
  const isRandomPrefix = values.prefixMode === PREFIX_MODE_RANDOM;
  const isRandomSubdomain = values.domainMode === DOMAIN_MODE_RANDOM_SUBDOMAIN;
  const isCustomSubdomain = values.domainMode === DOMAIN_MODE_CUSTOM_SUBDOMAIN;

  return {
    domain: normalizedDomain,
    localPart: isRandomPrefix ? undefined : normalizedLocalPart || undefined,
    random: isRandomPrefix,
    randomSubdomain: isRandomSubdomain,
    subdomain: isCustomSubdomain ? normalizedSubdomain || undefined : undefined,
  };
}

export const MAILBOX_PREFIX_MODES = [
  { label: '自定义前缀', value: PREFIX_MODE_CUSTOM },
  { label: '随机前缀', value: PREFIX_MODE_RANDOM },
];

export const MAILBOX_DOMAIN_MODES = [
  { label: '主域名', value: DOMAIN_MODE_ROOT },
  { label: '自定义子域名', value: DOMAIN_MODE_CUSTOM_SUBDOMAIN },
  { label: '随机子域名', value: DOMAIN_MODE_RANDOM_SUBDOMAIN },
];

export {
  PREFIX_MODE_CUSTOM,
  PREFIX_MODE_RANDOM,
  DOMAIN_MODE_ROOT,
  DOMAIN_MODE_CUSTOM_SUBDOMAIN,
  DOMAIN_MODE_RANDOM_SUBDOMAIN,
};