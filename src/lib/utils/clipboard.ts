/**
 * Robust cross-browser clipboard utility with support for insecure contexts (HTTP LAN),
 * mobile Safari, Chrome Android, and modern navigator.clipboard API.
 */
export async function copyToClipboard(text: string): Promise<boolean> {
  if (!text) return false;

  // 1. Try modern navigator.clipboard API when available in a secure context
  if (
    typeof navigator !== 'undefined' &&
    navigator.clipboard &&
    typeof navigator.clipboard.writeText === 'function' &&
    (typeof window === 'undefined' || window.isSecureContext !== false)
  ) {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch {
      // Fallback to execCommand if navigator.clipboard throws or rejects
    }
  }

  // 2. Resilient fallback using an invisible off-screen textarea + document.execCommand('copy')
  if (typeof document !== 'undefined') {
    try {
      const textArea = document.createElement('textarea');
      textArea.value = text;

      // Prevent scrolling and keep off-screen without hidden/display:none
      textArea.style.position = 'fixed';
      textArea.style.top = '0';
      textArea.style.left = '0';
      textArea.style.width = '2em';
      textArea.style.height = '2em';
      textArea.style.padding = '0';
      textArea.style.border = 'none';
      textArea.style.outline = 'none';
      textArea.style.boxShadow = 'none';
      textArea.style.background = 'transparent';
      textArea.style.opacity = '0';
      textArea.setAttribute('readonly', '');

      document.body.appendChild(textArea);

      // Support iOS Safari selection range
      const isIOS = /ipad|ipod|iphone/i.test(navigator.userAgent || '');
      if (isIOS) {
        const range = document.createRange();
        range.selectNodeContents(textArea);
        const selection = window.getSelection();
        if (selection) {
          selection.removeAllRanges();
          selection.addRange(range);
        }
        textArea.setSelectionRange(0, 999999);
      } else {
        textArea.select();
      }

      const successful = document.execCommand('copy');
      document.body.removeChild(textArea);
      return Boolean(successful);
    } catch (err) {
      console.warn('Fallback clipboard copy failed:', err);
      return false;
    }
  }

  return false;
}
