function normalizeRecipientAddress(recipientAddress) {
  return String(recipientAddress ?? '').trim().toLowerCase();
}

function extractDomainFromAddress(recipientAddress) {
  const normalizedRecipient = normalizeRecipientAddress(recipientAddress);
  const [, domain = ''] = normalizedRecipient.split('@');
  return domain;
}

export function resolveRecipientDomainStatus({ recipientAddress, domain }) {
  const normalizedRecipient = normalizeRecipientAddress(recipientAddress);
  const resolvedDomain = extractDomainFromAddress(normalizedRecipient);

  if (!domain || !domain.isActive) {
    return {
      ok: false,
      code: 'DOMAIN_NOT_CONFIGURED',
      message: 'Recipient domain is not configured or inactive',
      recipient: normalizedRecipient,
      domain: resolvedDomain,
    };
  }

  return {
    ok: true,
    code: 'RCPT_ACCEPTED',
    message: 'Recipient domain accepted',
    recipient: normalizedRecipient,
    domain: resolvedDomain,
  };
}

export function createRecipientValidationError({ recipientAddress }) {
  const error = new Error('Domain not configured');
  error.responseCode = 550;
  error.smtpCode = 'DOMAIN_NOT_CONFIGURED';
  error.recipient = normalizeRecipientAddress(recipientAddress);
  return error;
}

export function buildSmtpSessionMeta({ session }) {
  const remoteAddress = session?.remoteAddress || 'unknown';
  const clientHostname = session?.hostNameAppearsAs || 'unknown';
  const mailFrom = session?.envelope?.mailFrom?.address ?? null;
  const rcptTo = Array.isArray(session?.envelope?.rcptTo)
    ? session.envelope.rcptTo
        .map((item) => item?.address)
        .filter(Boolean)
        .map((address) => String(address).trim().toLowerCase())
    : [];

  return {
    remoteAddress,
    clientHostname,
    mailFrom,
    rcptTo,
  };
}