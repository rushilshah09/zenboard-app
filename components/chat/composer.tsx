'use client';
// The project conversation's composer — THE DS `MessageComposer` with chat's two bindings on it:
// the body check that matches 0043's check constraint (so the person is told before a round trip,
// not after one), and nothing else. The box, the keyboard and the send button moved to the design
// system when Ask needed the same ones; a second copy would be a second answer to "what does Enter
// do", which is the one question a person must never have to ask twice in one product.
import * as React from 'react';

import { MessageComposer, type MessageComposerProps } from '@/components/ds/ui';
import { normalizeBody } from '@/lib/chat';

export function Composer(props: Omit<MessageComposerProps, 'check'>) {
  return <MessageComposer check={normalizeBody} {...props} />;
}
