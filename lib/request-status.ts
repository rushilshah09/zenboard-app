// The request lifecycle status model, shared by the owner inbox, the portal, and
// the server actions (CLIENT_PORTAL_MASTER_PLAN.md §6). Plain module — no
// 'server-only', no DS import — so both server and client can compute the label.
//
// Decision state lives on the request (pending | needs_info | approved | declined).
// Delivery state (in progress / completed) is DERIVED from the linked task's
// `done` flag, never stored — so the client's view tracks real work honestly and
// a reopened task correctly falls back to "In progress".

export type RequestDecision = 'pending' | 'needs_info' | 'approved' | 'declined';

export type ClientRequestLabel =
  | 'Pending' | 'Needs your input' | 'Approved' | 'In progress' | 'Completed' | 'Declined';

// Badge tones (match the DS BadgeStatus union used across the app).
export type StatusTone = 'neutral' | 'info' | 'success' | 'warning' | 'danger' | 'accent';

/**
 * The status the CLIENT sees.
 * @param taskDone  null = no linked task yet · true = task completed · false = task open.
 */
export function clientRequestLabel(decision: RequestDecision, taskDone: boolean | null): ClientRequestLabel {
  switch (decision) {
    case 'declined':   return 'Declined';
    case 'needs_info': return 'Needs your input';
    case 'approved':   return taskDone == null ? 'Approved' : taskDone ? 'Completed' : 'In progress';
    default:           return 'Pending';
  }
}

export const CLIENT_LABEL_TONE: Record<ClientRequestLabel, StatusTone> = {
  'Pending': 'neutral',
  'Needs your input': 'warning',
  'Approved': 'info',
  'In progress': 'info',
  'Completed': 'success',
  'Declined': 'danger',
};

// The client-facing status of a single request, as projected to the portal.
export type PortalRequestMessage = { author: 'team' | 'client'; body: string; createdAt: string };
export type PortalRequestStatus = {
  id: string;
  title: string;
  label: ClientRequestLabel;
  resolutionNote: string | null;
  createdAt: string;
  canReply: boolean;
  messages: PortalRequestMessage[];
};

// Derive a short title from a free-text body: first non-empty line, trimmed.
export function deriveTitle(body: string): string {
  const first = (body.split('\n').find((l) => l.trim()) ?? '').trim();
  if (!first) return 'Client request';
  return first.length > 80 ? first.slice(0, 77).trimEnd() + '…' : first;
}
