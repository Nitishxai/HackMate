export function isSafeExternalUrl(value) {
  if (typeof value !== 'string' || !value.trim()) return false;

  try {
    return ['http:', 'https:'].includes(new URL(value.trim()).protocol);
  } catch {
    return false;
  }
}
