export function validateBookmarkUrl(value: string): string | null {
  try {
    const url = new URL(value);
    if (url.protocol !== 'http:' && url.protocol !== 'https:') {
      return 'Only HTTP and HTTPS URLs can be saved';
    }
    return null;
  } catch {
    return 'Enter a valid URL, including http:// or https://';
  }
}
