'use client';
// ── THE MESSAGE COMPOSER ───────────────────────────────────────────────────
//
// THE box you type a message into, wherever that is: a project conversation, the client portal,
// and Ask. It was `components/chat/composer.tsx`, private to the Slack-style module, until Ask
// needed exactly the same box — and a second copy of this would be a second answer to "what does
// Enter do", which is the one question a person must never have to ask twice in one product
// ([[zenboard-interaction-standards]]: the same act behaves the same everywhere).
//
// Slack's keyboard, exactly: Enter sends, Shift+Enter starts a new line. It opens ONE line tall and
// grows as you write (the DS Textarea's `compact` mode), because a box that opens three lines tall
// reads as a form to fill in.
//
// Enter does NOT send while an input method is composing. Someone typing Japanese, Chinese or
// Korean presses Enter to CONFIRM a character; sending on that key would post half a word every
// time. `isComposing` (and keyCode 229, which some browsers report instead) is the standard check.
//
// Nothing here waits for the server. The parent owns what happens next — an optimistic row in a
// conversation, a pending turn in Ask — and the box clears at once either way.

import * as React from 'react';

import { ArrowUp } from '@/components/ds/icons';
import { Icon } from './icon';
import { IconButton } from './icon-button';
import { Button } from './button';
import { Textarea } from './textarea';
import { cardClass } from './card';

/** What a check returns: the body to send, or the reason it cannot be sent. */
export type ComposerCheck = { ok: true; body: string } | { ok: false; error: string };

export type MessageComposerProps = {
  placeholder: string;
  /** Hand the checked body up. Returns nothing: the parent owns what happens next. */
  onSend: (body: string) => void;
  /**
   * What counts as sendable, and what to say when it is not. Each surface has its own bound (chat
   * has a database check constraint behind it, Ask has a prompt budget), and the person should be
   * told BEFORE a round trip rather than after one. Defaults to "anything non-empty".
   */
  check?: (raw: string) => ComposerCheck;
  /** The quiet line under the box. Defaults to teaching the keyboard once, where you are looking. */
  hint?: React.ReactNode;
  /**
   * Drop the container's own border and padding, for a composer that sits in a slot which already
   * has them — a Drawer footer, a card. The box, the button and the keyboard are unchanged.
   */
  bare?: boolean;
  /**
   * How much room the box asks for.
   *
   * `compact` (the default) opens at ONE line and grows: a conversation you are already inside,
   * where a three-line box reads as a form to fill in. `roomy` is the opposite case — a composer
   * that IS the page, with nothing said yet. There, one hairline line reads as a search field and
   * gives the primary act of the screen no presence at all, so the box is the surface: it carries
   * the border, the elevation and the focus ring, and the field inside it is chromeless.
   */
  size?: 'compact' | 'roomy';
  /**
   * `roomy` only: the quiet left end of the footer band, where the task composer puts "Today ⌄".
   * A caller says what the composer can SEE (the open record); with nothing to say, the keyboard
   * line sits there instead, which is a caption in its own strip rather than clutter under a card.
   */
  lead?: React.ReactNode;
  disabled?: boolean;
  autoFocus?: boolean;
  /**
   * Slack's ↑: in an EMPTY box, Up edits your last message. Only when empty — in a draft, Up has to
   * keep moving the caret between lines, or the shortcut would steal the key it is named after.
   */
  onEditLast?: () => boolean;
  /** Lets the parent put the caret back here — after an edit or a delete closes. */
  inputRef?: React.RefObject<HTMLTextAreaElement | null>;
};

const nonEmpty = (raw: string): ComposerCheck => {
  const body = raw.trim();
  return body ? { ok: true, body } : { ok: false, error: 'Write something first.' };
};

/** Taught once, quietly. `font-sans` because a `<kbd>` defaults to monospace and this app does not. */
const KEYBOARD_HINT = (
  <>
    <kbd className="font-sans">Enter</kbd> to send · <kbd className="font-sans">Shift</kbd> + <kbd className="font-sans">Enter</kbd> for a new line
  </>
);

export function MessageComposer({
  placeholder,
  onSend,
  check = nonEmpty,
  hint = KEYBOARD_HINT,
  bare = false,
  size = 'compact',
  lead,
  disabled,
  autoFocus,
  onEditLast,
  inputRef,
}: MessageComposerProps) {
  const [text, setText] = React.useState('');
  const [error, setError] = React.useState<string | null>(null);
  const ownRef = React.useRef<HTMLTextAreaElement>(null);
  const box = inputRef ?? ownRef;
  const errorId = React.useId();
  const canSend = !disabled && text.trim().length > 0;

  // Sending disables the field until the answer arrives (`disabled`), and the browser drops focus
  // from a field it disables — so a keyboard that just pressed Enter was left on <body>, a click
  // away from its next sentence ("and the timeline?"). Found 2026-09-29 asking a meeting in Ask.
  // The field takes focus back when it is enabled again, but only if it was the one that sent and
  // focus went nowhere since — never away from something the person moved to while they waited.
  const refocus = React.useRef(false);
  React.useEffect(() => {
    if (disabled || !refocus.current) return;
    refocus.current = false;
    const at = document.activeElement;
    if (!at || at === document.body || at === box.current) box.current?.focus();
  }, [disabled, box]);

  // ONE keyboard, both sizes. Enter sends, Shift+Enter is a new line, and an IME confirming a
  // character is never a send — written once so the two shapes cannot drift on the one rule a
  // person actually feels.
  const onKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'ArrowUp' && !text && !e.shiftKey && !e.altKey && !e.metaKey && !e.ctrlKey && onEditLast) {
      // Only swallow the key when there WAS something to edit.
      if (onEditLast()) e.preventDefault();
      return;
    }
    if (e.key !== 'Enter' || e.shiftKey) return;
    if (e.nativeEvent.isComposing || e.keyCode === 229) return; // an IME is confirming a character
    e.preventDefault();
    if (canSend) send();
  };

  const send = () => {
    const checked = check(text);
    if (!checked.ok) {
      setError(checked.error);
      return;
    }
    setError(null);
    refocus.current = true;
    onSend(checked.body);
    setText('');
    box.current?.focus();
  };

  const roomy = size === 'roomy';

  // ── ROOMY: ZENBOARD'S OWN COMPOSER ANATOMY ────────────────────────────────
  // Not a chat widget: the SAME shape as the task composer (components/tasks/tasks-view.tsx) —
  // a card, a chromeless field at lead size, and a full-bleed sunken footer band with a quiet
  // control at the left and the action at the right. User direction 2026-09-29, pointing at that
  // composer: a second anatomy for "a box you type into" would be the app speaking twice.
  //
  // The card owns the border, the elevation and the ring; the field inside is chromeless, because
  // a bordered field in a bordered card is the double-border fault the design audit named.
  if (roomy) {
    // NO focus ring on the card, and that is the house's own answer rather than a lapse: the task
    // composer this copies has none either. A 2px accent ring around a 500px card is not a focus
    // affordance, it is a frame around the only thing on the screen, and the field is focused the
    // moment the mode opens, so it would be the RESTING state. Focus is shown where focus is: the
    // caret, and the placeholder giving way to what you type. That is the `data-chromeless` tier
    // doing exactly what it was declared for.
    return (
      <div className={cardClass('overflow-hidden px-4 pt-3.5 shadow-lift-1')}>
        <Textarea
          ref={box}
          chromeless
          value={text}
          autoFocus={autoFocus}
          disabled={disabled}
          placeholder={placeholder}
          aria-label={placeholder}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? errorId : undefined}
          onChange={(e) => {
            setText(e.target.value);
            if (error) setError(null);
          }}
          onKeyDown={onKeyDown}
          className="min-h-[72px] p-0 text-lead"
        />

        {/* Footer band — full-bleed sunken strip: what it can see at the left, the action at the
            right. The negative margin is the card's own 16px inset, so the strip reaches both
            edges; the bottom radius is the card's, less its 1px border. */}
        <div className="mx-[-16px] mt-3 flex items-center gap-2 rounded-b-[calc(var(--radius-lg)-1px)] border-t border-line-soft bg-surface-band px-4 py-2.5">
          <span className="min-w-0 flex-1 truncate text-caption text-ink-500">
            {error ? <span id={errorId} role="alert" className="text-danger-600">{error}</span> : (lead ?? hint)}
          </span>
          <Button
            size="sm"
            variant="primary"
            disabled={!canSend}
            onClick={send}
            iconRight={<Icon icon={ArrowUp} size={14} />}
          >
            Send
          </Button>
        </div>
      </div>
    );
  }

  // ── COMPACT: THE SAME ANATOMY, ONE LINE TALL ──────────────────────────────
  // A conversation's composer is a WORKSPACE surface, not a chat widget's text bar (2026-10-02 brief:
  // "the input area should feel like a premium workspace rather than a chatbot textbox"). It was a
  // bare wash field with a floating send button and the keyboard line hung underneath the box. It is
  // now the roomy composer's anatomy at a conversation's size: one raised card, a chromeless field
  // that opens one line tall and grows, and a footer row INSIDE the card — what the box knows at the
  // left, the send at the right. One shape for every box you type a message into, two sizes.
  //
  // The slot around it lost its top rule: a card sitting under a hairline is two edges for one
  // boundary. The space above it separates it from the conversation now.
  return (
    // On the conversation's reading column (message-list.tsx), so the box sits under the words.
    <div className={bare ? undefined : 'mx-auto w-full max-w-[var(--measure)] px-5 pb-4 pt-2'}>
      <div className={cardClass('px-3 pb-2 pt-2.5 transition-shadow duration-fast focus-within:shadow-lift-1')}>
        <Textarea
          ref={box}
          compact
          chromeless
          value={text}
          autoFocus={autoFocus}
          disabled={disabled}
          placeholder={placeholder}
          aria-label={placeholder}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? errorId : undefined}
          onChange={(e) => {
            setText(e.target.value);
            if (error) setError(null);
          }}
          onKeyDown={onKeyDown}
          className="p-0 text-ui"
        />
        <div className="mt-1.5 flex items-center gap-2">
          <span className="min-w-0 flex-1 truncate text-caption text-ink-500">
            {error ? <span id={errorId} role="alert" className="text-danger-600">{error}</span> : (lead ?? hint)}
          </span>
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
    </div>
  );

}
