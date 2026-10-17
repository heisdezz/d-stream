export function validateWriteToken(value: string): string {
  const token = value.trim();
  if (!token || /[^\x20-\x7e]/.test(token)) {
    throw new Error('Enter a nonempty printable write token from the desktop Sync settings.');
  }
  return token;
}
