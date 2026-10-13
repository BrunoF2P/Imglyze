export const appleSecrets = ['APPLE_CERTIFICATE', 'APPLE_CERTIFICATE_PASSWORD', 'APPLE_SIGNING_IDENTITY',
  'APPLE_ID', 'APPLE_PASSWORD', 'APPLE_TEAM_ID'];

export function withoutEmptyAppleSecrets(env) {
  const result = { ...env };
  for (const name of appleSecrets) {
    if (result[name] === '') delete result[name];
  }
  return result;
}
