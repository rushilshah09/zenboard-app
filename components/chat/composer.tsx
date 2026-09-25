'use client';
// ── THE COMPOSER ───────────────────────────────────────────────────────────
//
// Slack's keyboard, exactly: Enter sends, Shift+Enter starts a new line. It opens ONE line tall and
// grows as you write (the DS Textarea's `compact` mode), because a chat box that opens three lines
// tall reads as a form to fill in.
//
// Enter does NOT send while an input method is composing. Someone typing Japanese, Chinese or
// Korean presses Enter to CONFIRM a character; sending on that key would post half a word every
// time. `isComposing` (and keyCode 229, which some browsers report instead) is the standard check.
//
// Nothing here waits for the server. The parent appends the message optimistically and clears the
// box at once; if the send fails, the message stays in the list with a Retry — what you wrote is
// never thrown away.

import * as React from 'react';
import { ArrowUp } from '@/components/ds/icons';
import { Icon, IconButton, Textarea } from '@/components/ds/ui';
import { normalizeBody } from '@/lib/chat';

export function Composer({
  placeholder,
  onSend,
  disabled,
  autoFocus,
}: {
  placeholder: string;
  /** Hand the checked body up. Returns nothing: the parent owns the optimistic row. */
  onSend: (body: string) => void;
  disabled?: boolean;
  autoFocus?: boolean;
}) {
  const [text, setText] = React.useState('');
  const [error, setError] = React.useState<string | null>(null);
  const box = React.useRef<HTMLTextAreaElement>(null);
  const canSend = !disabled && text.trim().length > 0;

  const send = () => {
    const checked = normalizeBody(text);
    if (!checked.ok) {
      setError(checked.error);
      return;
    }
    setError(null);
    onSend(checked.body);
    setText('');
    box.current?.focus();
  };

  return (
    <div className="border-t border-line-soft px-5 pb-4 pt-3">
      <div className="relative">
        <Textarea
          ref={box}
          compact
          value={text}
          autoFocus={autoFocus}
          disabled={disabled}
          placeholder={placeholder}
          aria-label={placeholder}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? 'composer-error' : undefined}
          onChange={(e) => {
            setText(e.target.value);
            if (error) setError(null);
          }}
          onKeyDown={(e) => {
            if (e.key !== 'Enter' || e.shiftKey) return;
            if (e.nativeEvent.isComposing || e.keyCode === 229) return; // an IME is confirming a character
            e.preventDefault();
            if (canSend) send();
          }}
          // Room on the right for the send button, so a long line never runs under it.
          className="pe-11"
        />
        <div className="absolute bottom-1.5 end-1.5">
          <IconButton
            label="Send"
            size="sm"
            variant={canSend ? 'primary' : 'ghost'}
            disabled={!canSend}
            icon={<Icon icon={ArrowUp} size={16} />}
            onClick={send}
          />
        </div>
      </div>
      {error ? (
        <p id="composer-error" className="mt-1.5 text-caption text-danger-600" role="alert">{error}</p>
      ) : (
        // The keyboard is taught once, quietly, where you are already looking.
        <p className="mt-1.5 text-caption text-ink-500">
          <kbd className="font-sans">Enter</kbd> to send · <kbd className="font-sans">Shift</kbd> + <kbd className="font-sans">Enter</kbd> for a new line
        </p>
      )}
    </div>
  );
}
