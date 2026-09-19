/**
 * Global Keyboard Guard
 * Prevents the browser from navigating back in history when Backspace is pressed:
 * 1. Outside of an editable text field (e.g. background, buttons, dropdowns).
 * 2. In disabled or read-only inputs.
 * 3. At the beginning of an input field (position 0) where Backspace cannot delete
 *    any text and browsers/extensions default to window.history.back().
 */
export function initKeyboardGuard() {
  if (typeof window === 'undefined') return;

  window.addEventListener(
    'keydown',
    (e: KeyboardEvent) => {
      // Check for Backspace key (key === 'Backspace' or keyCode 8)
      if (e.key !== 'Backspace' && e.keyCode !== 8) {
        return;
      }

      const target = (e.composedPath ? e.composedPath()[0] : e.target) as HTMLElement | null;
      const activeEl = document.activeElement as HTMLElement | null;
      const element = (target || activeEl) as HTMLElement | null;

      if (!element) {
        e.preventDefault();
        return;
      }

      const tagName = element.tagName?.toUpperCase();
      const isContentEditable = element.isContentEditable;
      const isInput = tagName === 'INPUT';
      const isTextarea = tagName === 'TEXTAREA';
      const isEditable = isInput || isTextarea || isContentEditable;

      // Case 1: Focus is NOT on an editable element (e.g. page body, table, button, modal backdrop)
      if (!isEditable) {
        e.preventDefault();
        return;
      }

      // Case 2: Element is input/textarea, but is disabled or readOnly
      const input = element as HTMLInputElement | HTMLTextAreaElement;
      if (input.readOnly || input.disabled) {
        e.preventDefault();
        return;
      }

      // Case 3: Element is non-text input type (checkbox, radio, button, submit, color, etc.)
      if (isInput) {
        const inputType = (input.type || '').toLowerCase();
        const nonTextTypes = ['checkbox', 'radio', 'button', 'submit', 'reset', 'file', 'image', 'color', 'range'];
        if (nonTextTypes.includes(inputType)) {
          e.preventDefault();
          return;
        }
      }

      // Case 4: Text input/textarea at cursor position 0 with no selected text
      // (When an input is empty or cursor is at start, some browsers trigger history.back())
      if (isInput || isTextarea) {
        try {
          const start = input.selectionStart;
          const end = input.selectionEnd;
          if (start !== null && end !== null) {
            const hasSelection = start !== end;
            const isAtBeginning = start === 0 && end === 0;
            if (isAtBeginning && !hasSelection) {
              // Nothing to delete; prevent browser navigation
              e.preventDefault();
              return;
            }
          }
        } catch {
          // For input types that don't support selectionStart (e.g. type="number")
          if (!input.value) {
            e.preventDefault();
            return;
          }
        }
      }
    },
    { capture: true }
  );
}
