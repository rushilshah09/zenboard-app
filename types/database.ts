// Typed database schema. The authoritative version is generated from the live
// project with:  npx supabase gen types typescript --project-id <id> > types/database.ts
// Until the Supabase project exists, this hand-authored subset covers the tables
// used through Phase 1–2. Keep it in sync with supabase/migrations/0001_init.sql.

type Timestamps = { created_at: string; updated_at: string };

export type Role = 'individual' | 'freelancer' | 'founder';
export type SpaceTag = 'WORK' | 'LIFE' | 'SIDE';
export type Priority = 'low' | 'med' | 'high';
export type Horizon = 'month' | 'quarter' | 'year';
export type RitualType = 'daily_plan' | 'daily_shutdown' | 'weekly_review';

export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string;
          full_name: string | null;
          role: Role | null;
          avatar_url: string | null;
          onboarding_complete: boolean;
          /**
           * Free-form per-user JSON. Already carries accent / density /
           * displayFont, the Google-sync metadata, and now `pins` — the
           * sidebar's own list (lib/pins.ts). The index signature is the point:
           * this column is a bag of preferences, and typing only the keys one
           * feature happens to know about is how the next feature clobbers them.
           * Every write must READ-MODIFY-WRITE the whole object.
           */
          preferences: {
            accent?: string;
            density?: 'comfortable' | 'compact';
            displayFont?: string;
            pins?: { type: string; id: string; label: string }[];
          } & Record<string, unknown>;
          hourly_rate: number;
        } & Timestamps;
        Insert: { id: string; full_name?: string | null; role?: Role | null; avatar_url?: string | null; onboarding_complete?: boolean; preferences?: Record<string, unknown>; hourly_rate?: number };
        Update: Partial<Database['public']['Tables']['profiles']['Insert']>;
        Relationships: [];
      };
      spaces: {
        Row: { id: string; user_id: string; name: string; emoji: string | null; color: string; tag: SpaceTag | null; sort_order: number } & Timestamps;
        Insert: { id?: string; user_id: string; name: string; emoji?: string | null; color?: string; tag?: SpaceTag | null; sort_order?: number };
        Update: Partial<Database['public']['Tables']['spaces']['Insert']>;
        Relationships: [];
      };
      projects: {
        Row: { id: string; user_id: string; space_id: string; client_id: string | null; name: string; color: string | null; icon: string | null; status: string; deadline: string | null; deadline_label: string | null; portal_enabled: boolean; portal_token: string | null; share_progress: boolean; share_completed_tasks: boolean; share_open_tasks: boolean; share_timeline: boolean; share_files: boolean; share_invoices: boolean; allow_requests: boolean; portal_intro: string | null } & Timestamps;
        Insert: { id?: string; user_id: string; space_id: string; client_id?: string | null; name: string; color?: string | null; icon?: string | null; status?: string; deadline?: string | null; deadline_label?: string | null; portal_enabled?: boolean; portal_token?: string | null; share_progress?: boolean; share_completed_tasks?: boolean; share_open_tasks?: boolean; share_timeline?: boolean; share_files?: boolean; share_invoices?: boolean; allow_requests?: boolean; portal_intro?: string | null };
        Update: Partial<Database['public']['Tables']['projects']['Insert']>;
        Relationships: [];
      };
      project_activity: {
        Row: { id: string; project_id: string; user_id: string; type: string; body: string | null; created_at: string };
        Insert: { id?: string; project_id: string; user_id: string; type: string; body?: string | null };
        Update: Partial<Database['public']['Tables']['project_activity']['Insert']>;
        Relationships: [];
      };
      // The fabric's typed edge (0027 — VERIFIED APPLIED by a live probe on
      // 2026-08-03, unlike 0028). `target_id` intentionally has no FK: the
      // target is polymorphic, and a deleted target becomes a tombstone rather
      // than taking its backlinks with it.
      mentions: {
        Row: { id: string; user_id: string; space_id: string | null; source_type: string; source_id: string; target_type: string; target_id: string; anchor: string | null; context: string | null; origin: 'mention' | 'suggested'; created_at: string };
        Insert: { id?: string; user_id: string; space_id?: string | null; source_type: string; source_id: string; target_type: string; target_id: string; anchor?: string | null; context?: string | null; origin?: 'mention' | 'suggested' };
        Update: Partial<Database['public']['Tables']['mentions']['Insert']>;
        Relationships: [];
      };
      // Memory — the sixth layer (§7X, migration 0029, DRAFTED and NOT applied
      // as of 2026-08-06). Typed here so the gated code compiles; every read and
      // write goes through `memoriesSupported()` and degrades to nothing until
      // the migration lands.
      //
      // `subject_id` is null for exactly one subject_type — 'self', which is you,
      // and is the only subject with no row anywhere (0029's
      // `memories_subject_shape`). `space_id` is null for the same rows: a fact
      // about you is true in every space.
      // Block comments (§7H, migration 0037 — WRITTEN, awaiting paste as of
      // 2026-08-06). Typed here so the gated code compiles; every read and write
      // goes through `commentsSupported()` and degrades to the pre-0037
      // page-level comments in `pages.content` until the migration lands.
      //
      // `block_id` is TEXT with no foreign key on purpose: a block is not a row
      // (see lib/block-link.ts). An anchor whose block was deleted is an orphan
      // the read path shows, exactly like a `mentions` tombstone.
      comments: {
        Row: {
          id: string; user_id: string; space_id: string | null;
          page_id: string; block_id: string | null; thread_id: string;
          body: string; author_name: string | null; resolved_at: string | null;
          created_at: string;
        };
        Insert: {
          id?: string; user_id: string; space_id?: string | null;
          page_id: string; block_id?: string | null; thread_id?: string;
          body: string; author_name?: string | null; resolved_at?: string | null;
          created_at?: string;
        };
        Update: Partial<Database['public']['Tables']['comments']['Insert']>;
        Relationships: [];
      };
      memories: {
        Row: {
          id: string; user_id: string; space_id: string | null;
          body: string; kind: string;
          subject_type: string; subject_id: string | null;
          origin: string;
          source_type: string | null; source_id: string | null; anchor: string | null;
          valid_from: string; invalid_from: string | null; superseded_by: string | null;
          confidence: number; recall_count: number; last_recalled_at: string | null;
          pinned: boolean; archived_at: string | null;
        } & Timestamps;
        Insert: {
          id?: string; user_id: string; space_id?: string | null;
          body: string; kind?: string;
          subject_type: string; subject_id?: string | null;
          origin?: string;
          source_type?: string | null; source_id?: string | null; anchor?: string | null;
          valid_from?: string; invalid_from?: string | null; superseded_by?: string | null;
          confidence?: number; recall_count?: number; last_recalled_at?: string | null;
          pinned?: boolean; archived_at?: string | null;
        };
        Update: Partial<Database['public']['Tables']['memories']['Insert']>;
        Relationships: [];
      };
      goals: {
        // progress_at_review + retro arrive with 0026 (drafted, NOT applied) — typed
        // here so the gated code compiles; every write that touches them degrades.
        Row: { id: string; user_id: string; space_id: string; project_id: string | null; title: string; note: string | null; horizon: Horizon; cadence: 'weekly' | 'monthly'; progress: number; behind: boolean; last_reviewed: string | null; target_date: string | null; status: string; progress_at_review?: number | null; retro?: string | null } & Timestamps;
        Insert: { id?: string; user_id: string; space_id: string; project_id?: string | null; title: string; note?: string | null; horizon?: Horizon; cadence?: 'weekly' | 'monthly'; progress?: number; behind?: boolean; last_reviewed?: string | null; target_date?: string | null; status?: string; progress_at_review?: number | null; retro?: string | null };
        Update: Partial<Database['public']['Tables']['goals']['Insert']>;
        Relationships: [];
      };
      milestones: {
        // 0036 — a milestone belongs to a goal OR a project, exactly one
        // (`milestones_one_owner`). `goal_id` was NOT NULL until then, which is
        // why it is nullable here. `due_date` makes it a DATED checkpoint (§7E).
        Row: { id: string; user_id: string; goal_id: string | null; project_id: string | null; title: string; done: boolean; due_date: string | null; sort_order: number } & Timestamps;
        Insert: { id?: string; user_id: string; goal_id?: string | null; project_id?: string | null; title: string; done?: boolean; due_date?: string | null; sort_order?: number };
        Update: Partial<Database['public']['Tables']['milestones']['Insert']>;
        Relationships: [];
      };
      tasks: {
        Row: {
          id: string; user_id: string; space_id: string; project_id: string | null; goal_id: string | null;
          parent_task_id: string | null; title: string; notes: string | null; priority: Priority; done: boolean;
          highlight: boolean; scheduled_date: string | null; due_date: string | null; is_inbox: boolean; estimate_minutes: number | null;
          elapsed_minutes: number; recurrence: Record<string, unknown> | null; completed_at: string | null; sort_order: number; client_visible: boolean; status: string | null; section_id: string | null; request_id: string | null;
          // 0030 — the timebox twin (lib/timebox.ts). Gated: taskEventsSupported().
          event_id: string | null;
          // 0031 — the one reminder (lib/reminders.ts). Gated: remindersSupported().
          // `remind_at` is WHEN to speak, `reminded_at` is when we did; the
          // latter is what makes delivery claimable exactly once.
          remind_at: string | null; reminded_at: string | null;
          // 0038 — the task's list (lib/task-scopes.ts). Gated: taskListsSupported().
          // Independent of `project_id`: a task may be in a list, a project,
          // both, or neither — they answer different questions.
          list_id: string | null;
        } & Timestamps;
        Insert: {
          id?: string; user_id: string; space_id: string; project_id?: string | null; goal_id?: string | null;
          parent_task_id?: string | null; title: string; notes?: string | null; priority?: Priority; done?: boolean;
          highlight?: boolean; scheduled_date?: string | null; due_date?: string | null; is_inbox?: boolean; estimate_minutes?: number | null;
          elapsed_minutes?: number; recurrence?: Record<string, unknown> | null; completed_at?: string | null; sort_order?: number; client_visible?: boolean; status?: string | null; section_id?: string | null; request_id?: string | null; event_id?: string | null;
          remind_at?: string | null; reminded_at?: string | null; list_id?: string | null;
        };
        Update: Partial<Database['public']['Tables']['tasks']['Insert']>;
        Relationships: [];
      };
      // 0038 — Lists. A pile you keep your own work in, separate from projects.
      task_lists: {
        Row: { id: string; user_id: string; space_id: string; name: string; color: string | null; sort_order: number; created_at: string };
        Insert: { id?: string; user_id: string; space_id: string; name: string; color?: string | null; sort_order?: number };
        Update: Partial<Database['public']['Tables']['task_lists']['Insert']>;
        Relationships: [];
      };
      task_comments: {
        Row: { id: string; user_id: string; task_id: string; body: string; created_at: string };
        Insert: { id?: string; user_id: string; task_id: string; body: string };
        Update: Partial<Database['public']['Tables']['task_comments']['Insert']>;
        Relationships: [];
      };
      task_activity: {
        Row: { id: string; user_id: string; task_id: string; kind: string; meta: Record<string, unknown>; created_at: string };
        Insert: { id?: string; user_id: string; task_id: string; kind: string; meta?: Record<string, unknown> };
        Update: Partial<Database['public']['Tables']['task_activity']['Insert']>;
        Relationships: [];
      };
      labels: {
        Row: { id: string; user_id: string; space_id: string; name: string; color: string | null; sort_order: number; created_at: string };
        Insert: { id?: string; user_id: string; space_id: string; name: string; color?: string | null; sort_order?: number };
        Update: Partial<Database['public']['Tables']['labels']['Insert']>;
        Relationships: [];
      };
      task_labels: {
        Row: { task_id: string; label_id: string; user_id: string; created_at: string };
        Insert: { task_id: string; label_id: string; user_id: string };
        Update: Partial<Database['public']['Tables']['task_labels']['Insert']>;
        Relationships: [];
      };
      // 0032 — dependencies (lib/task-links.ts). Gated: taskLinksSupported().
      // One edge, read from both ends: `task_id` waits for `blocked_by_task_id`.
      task_links: {
        Row: { id: string; user_id: string; task_id: string; blocked_by_task_id: string; created_at: string };
        Insert: { id?: string; user_id: string; task_id: string; blocked_by_task_id: string };
        Update: Partial<Database['public']['Tables']['task_links']['Insert']>;
        Relationships: [];
      };
      // A WORKSTREAM (lib/workstreams.ts). Still called `sections` because this
      // table already WAS the Project → X → Task level; 0040 gave it the three
      // fields that make it a workstream rather than a heading. All optional on
      // Row: the columns do not exist until 0040 is applied, and every reader
      // treats a missing `client_visible` as internal.
      sections: {
        Row: { id: string; user_id: string; project_id: string; name: string; sort_order: number; status?: string | null; due_date?: string | null; client_visible?: boolean; created_at: string };
        Insert: { id?: string; user_id: string; project_id: string; name: string; sort_order?: number ; status?: string | null; due_date?: string | null; client_visible?: boolean };
        Update: Partial<Database['public']['Tables']['sections']['Insert']>;
        Relationships: [];
      };
      time_entries: {
        Row: { id: string; user_id: string; task_id: string | null; project_id: string | null; started_at: string; ended_at: string | null; minutes: number | null; source: 'timer' | 'manual'; billed: boolean; created_at: string; billable: boolean; rate: number | null; note: string | null; invoiced_invoice_id: string | null };
        Insert: { id?: string; user_id: string; task_id?: string | null; project_id?: string | null; started_at: string; ended_at?: string | null; minutes?: number | null; source?: 'timer' | 'manual'; billed?: boolean; billable?: boolean; rate?: number | null; note?: string | null; invoiced_invoice_id?: string | null };
        Update: Partial<Database['public']['Tables']['time_entries']['Insert']>;
        Relationships: [];
      };
      habits: {
        // schedule_* (0025 §3) is which DAYS the habit is due; goal_target is how
        // many times in such a day counts as done. goal_period is retained for
        // back-compat and no longer read — see lib/habit-schedule.ts.
        Row: { id: string; user_id: string; space_id: string | null; title: string; cadence: string; active: boolean; created_at: string; time_of_day: string; goal_target: number; goal_period: string; sort_order: number; archived: boolean; color: string | null; schedule_kind: string; schedule_days: number[]; schedule_count: number };
        Insert: { id?: string; user_id: string; space_id?: string | null; title: string; cadence?: string; active?: boolean; time_of_day?: string; goal_target?: number; goal_period?: string; sort_order?: number; archived?: boolean; color?: string | null; schedule_kind?: string; schedule_days?: number[]; schedule_count?: number };
        Update: Partial<Database['public']['Tables']['habits']['Insert']>;
        Relationships: [];
      };
      habit_logs: {
        // A partial day is `count > 0, done = false` — progress without a claim
        // of completion, so everything that reads `done` is unaffected.
        Row: { id: string; user_id: string; habit_id: string; log_date: string; done: boolean; status: string; count: number };
        Insert: { id?: string; user_id: string; habit_id: string; log_date: string; done?: boolean; status?: string; count?: number };
        Update: Partial<Database['public']['Tables']['habit_logs']['Insert']>;
        Relationships: [];
      };
      // 0033 — attachments (§7H). Gated: attachmentsSupported(). Exactly one of
      // page_id / task_id / project_id is set (enforced by a CHECK in 0033).
      attachments: {
        // 0039 — `client_visible` is the same column, same default and same
        // meaning as on `tasks` and `pages`, so one rule (lib/visibility.ts)
        // reads all three. Optional on Row because the column does not exist
        // until the migration is applied, and every reader treats missing as
        // private.
        Row: { id: string; user_id: string; space_id: string | null; page_id: string | null; task_id: string | null; project_id: string | null; path: string; filename: string; mime_type: string | null; size_bytes: number | null; client_visible?: boolean; created_at: string };
        Insert: { id?: string; user_id: string; space_id?: string | null; page_id?: string | null; task_id?: string | null; project_id?: string | null; path: string; filename: string; mime_type?: string | null; size_bytes?: number | null; client_visible?: boolean };
        Update: Partial<Database['public']['Tables']['attachments']['Insert']>;
        Relationships: [];
      };
      // 0034 — acceptances (§7M). Gated: acceptancesSupported(). One row per
      // signed accept block; `unique(page_id, block_id)` makes accepting
      // idempotent. `invoice_id` is 0035 — gated separately, on the COLUMN.
      //
      // The Update type lists exactly the two columns the 0034 trigger permits,
      // which is the immutability rule written where TypeScript can enforce it:
      // who signed, when, for what, and from where are unwritable after the
      // fact, while the crossing can still record which invoice it drafted.
      acceptances: {
        Row: { id: string; user_id: string; page_id: string; project_id: string | null; block_id: string; signer_name: string; signer_email: string | null; accepted_at: string; ip: string | null; user_agent: string | null; statement: string; content: unknown; content_hash: string; amount: number | null; invoice_id: string | null; created_at: string };
        Insert: { id?: string; user_id: string; page_id: string; project_id?: string | null; block_id: string; signer_name: string; signer_email?: string | null; ip?: string | null; user_agent?: string | null; statement: string; content: unknown; content_hash: string; amount?: number | null };
        Update: { invoice_id?: string | null; project_id?: string | null };
        Relationships: [];
      };
      calendar_events: {
        Row: { id: string; user_id: string; space_id: string | null; title: string; starts_at: string; ends_at: string | null; all_day: boolean; source: string; external_id: string | null; created_at: string; task_id: string | null };
        Insert: { id?: string; user_id: string; space_id?: string | null; title: string; starts_at: string; ends_at?: string | null; all_day?: boolean; source?: string; external_id?: string | null; task_id?: string | null };
        Update: Partial<Database['public']['Tables']['calendar_events']['Insert']>;
        Relationships: [];
      };
      calendar_connections: {
        Row: { id: string; user_id: string; provider: string; account_email: string | null; access_token: string | null; refresh_token: string | null; token_expires_at: string | null; calendar_id: string; sync_token: string | null; created_at: string; updated_at: string };
        Insert: { id?: string; user_id: string; provider?: string; account_email?: string | null; access_token?: string | null; refresh_token?: string | null; token_expires_at?: string | null; calendar_id?: string; sync_token?: string | null; updated_at?: string };
        Update: Partial<Database['public']['Tables']['calendar_connections']['Insert']>;
        Relationships: [];
      };
      rituals: {
        Row: { id: string; user_id: string; type: RitualType; ritual_date: string; reflection: string | null; highlight_task_id: string | null; energy: number | null; data: Record<string, unknown>; completed_at: string | null };
        Insert: { id?: string; user_id: string; type: RitualType; ritual_date: string; reflection?: string | null; highlight_task_id?: string | null; energy?: number | null; data?: Record<string, unknown>; completed_at?: string | null };
        Update: Partial<Database['public']['Tables']['rituals']['Insert']>;
        Relationships: [];
      };
      clients: {
        Row: { id: string; user_id: string; space_id: string | null; name: string; contact: string | null; role: string | null; email: string | null; status: string; health: string; since: string | null; next_step: string | null } & Timestamps;
        Insert: { id?: string; user_id: string; space_id?: string | null; name: string; contact?: string | null; role?: string | null; email?: string | null; status?: string; health?: string; since?: string | null; next_step?: string | null };
        Update: Partial<Database['public']['Tables']['clients']['Insert']>;
        Relationships: [];
      };
      client_notes: {
        Row: { id: string; user_id: string; client_id: string; body: string; created_at: string };
        Insert: { id?: string; user_id: string; client_id: string; body: string };
        Update: Partial<Database['public']['Tables']['client_notes']['Insert']>;
        Relationships: [];
      };
      leads: {
        Row: { id: string; user_id: string; name: string; contact: string | null; value: number; stage: 'lead' | 'contacted' | 'proposal' | 'won'; source: string | null; note: string | null } & Timestamps;
        Insert: { id?: string; user_id: string; name: string; contact?: string | null; value?: number; stage?: 'lead' | 'contacted' | 'proposal' | 'won'; source?: string | null; note?: string | null };
        Update: Partial<Database['public']['Tables']['leads']['Insert']>;
        Relationships: [];
      };
      feedback: {
        Row: { id: string; user_id: string; space_id: string | null; number: number; title: string; body: string | null; status: 'open' | 'planned' | 'in_progress' | 'shipped' | 'declined'; source: string | null; client_id: string | null; meeting_id: string | null; task_id: string | null } & Timestamps;
        Insert: { id?: string; user_id: string; space_id?: string | null; number?: number; title: string; body?: string | null; status?: 'open' | 'planned' | 'in_progress' | 'shipped' | 'declined'; source?: string | null; client_id?: string | null; meeting_id?: string | null; task_id?: string | null };
        Update: Partial<Database['public']['Tables']['feedback']['Insert']>;
        Relationships: [];
      };
      meetings: {
        Row: { id: string; user_id: string; space_id: string | null; client_id: string | null; title: string; notes: string | null; met_at: string } & Timestamps;
        Insert: { id?: string; user_id: string; space_id?: string | null; client_id?: string | null; title: string; notes?: string | null; met_at?: string };
        Update: Partial<Database['public']['Tables']['meetings']['Insert']>;
        Relationships: [];
      };
      feedback_deals: {
        Row: { feedback_id: string; lead_id: string; user_id: string; created_at: string };
        Insert: { feedback_id: string; lead_id: string; user_id: string };
        Update: Partial<Database['public']['Tables']['feedback_deals']['Insert']>;
        Relationships: [];
      };
      folders: {
        Row: { id: string; user_id: string; space_id: string | null; name: string; parent_folder_id: string | null; sort_order: number; created_at: string };
        Insert: { id?: string; user_id: string; space_id?: string | null; name: string; parent_folder_id?: string | null; sort_order?: number };
        Update: Partial<Database['public']['Tables']['folders']['Insert']>;
        Relationships: [];
      };
      pages: {
        Row: { id: string; user_id: string; space_id: string; folder_id: string | null; project_id: string | null; title: string | null; type: string; content: Record<string, unknown>; tags: string[]; is_daily: boolean; daily_date: string | null; client_visible: boolean; parent_id: string | null; client_id: string | null; icon: string | null; cover: string | null; is_pinned: boolean; is_favorite: boolean; archived_at: string | null; sort_index: number; database_id: string | null; properties: Record<string, unknown>; row_order: string | null } & Timestamps;
        Insert: { id?: string; user_id: string; space_id: string; folder_id?: string | null; project_id?: string | null; title?: string | null; type?: string; content?: Record<string, unknown>; tags?: string[]; is_daily?: boolean; daily_date?: string | null; client_visible?: boolean; parent_id?: string | null; client_id?: string | null; icon?: string | null; cover?: string | null; is_pinned?: boolean; is_favorite?: boolean; archived_at?: string | null; sort_index?: number; updated_at?: string; database_id?: string | null; properties?: Record<string, unknown>; row_order?: string | null };
        Update: Partial<Database['public']['Tables']['pages']['Insert']>;
        Relationships: [];
      };
      // Shipped in 0001 and unused until version history (lib/actions/versions.ts).
      // No user_id column — RLS resolves ownership through `pages`.
      page_versions: {
        Row: { id: string; page_id: string; content: Record<string, unknown>; created_at: string };
        Insert: { id?: string; page_id: string; content: Record<string, unknown>; created_at?: string };
        Update: Partial<Database['public']['Tables']['page_versions']['Insert']>;
        Relationships: [];
      };
      client_requests: {
        Row: { id: string; project_id: string; client_token: string; name: string | null; title: string | null; body: string; status: 'pending' | 'needs_info' | 'approved' | 'declined'; client_id: string | null; task_id: string | null; resolution_note: string | null; created_at: string; updated_at: string };
        Insert: { id?: string; project_id: string; client_token: string; name?: string | null; title?: string | null; body: string; status?: 'pending' | 'needs_info' | 'approved' | 'declined'; client_id?: string | null; task_id?: string | null; resolution_note?: string | null; created_at?: string };
        Update: Partial<Database['public']['Tables']['client_requests']['Insert']>;
        Relationships: [];
      };
      request_messages: {
        Row: { id: string; request_id: string; author: 'team' | 'client'; body: string; client_facing: boolean; created_at: string };
        Insert: { id?: string; request_id: string; author: 'team' | 'client'; body: string; client_facing?: boolean; created_at?: string };
        Update: Partial<Database['public']['Tables']['request_messages']['Insert']>;
        Relationships: [];
      };
      // 0043 — a Slack-style channel per project (CHAT_PLAN.md). Gated by `chatSupported()`.
      project_messages: {
        Row: { id: string; project_id: string; author: 'team' | 'client'; author_name: string | null; body: string; created_at: string; edited_at: string | null; deleted_at: string | null };
        Insert: { id?: string; project_id: string; author: 'team' | 'client'; author_name?: string | null; body: string; created_at?: string; edited_at?: string | null; deleted_at?: string | null };
        Update: Partial<Database['public']['Tables']['project_messages']['Insert']>;
        Relationships: [];
      };
      project_message_reads: {
        Row: { project_id: string; reader: 'team' | 'client'; last_read_at: string };
        Insert: { project_id: string; reader: 'team' | 'client'; last_read_at?: string };
        Update: Partial<Database['public']['Tables']['project_message_reads']['Insert']>;
        Relationships: [];
      };
      approvals: {
        Row: { id: string; project_id: string; page_id: string; title: string | null; status: 'awaiting' | 'approved' | 'changes_requested'; note: string | null; decided_at: string | null; created_at: string; updated_at: string };
        Insert: { id?: string; project_id: string; page_id: string; title?: string | null; status?: 'awaiting' | 'approved' | 'changes_requested'; note?: string | null; decided_at?: string | null; created_at?: string };
        Update: Partial<Database['public']['Tables']['approvals']['Insert']>;
        Relationships: [];
      };
      forms: {
        Row: { id: string; user_id: string; space_id: string | null; client_id: string | null; project_id: string | null; title: string; description: string | null; status: 'draft' | 'live' | 'closed'; content: unknown; version: number; settings: unknown; share_token: string | null; is_template: boolean; show_in_portal: boolean; view_count: number } & Timestamps;
        Insert: { id?: string; user_id: string; space_id?: string | null; client_id?: string | null; project_id?: string | null; title?: string; description?: string | null; status?: 'draft' | 'live' | 'closed'; content?: unknown; version?: number; settings?: unknown; share_token?: string | null; is_template?: boolean; show_in_portal?: boolean; view_count?: number };
        Update: Partial<Database['public']['Tables']['forms']['Insert']>;
        Relationships: [];
      };
      form_versions: {
        Row: { form_id: string; version: number; content: unknown; settings: unknown; published_at: string };
        Insert: { form_id: string; version: number; content: unknown; settings?: unknown; published_at?: string };
        Update: Partial<Database['public']['Tables']['form_versions']['Insert']>;
        Relationships: [];
      };
      form_responses: {
        Row: { id: string; form_id: string; form_version: number; status: 'partial' | 'complete'; answers: unknown; respondent: unknown; meta: unknown; task_id: string | null } & Timestamps;
        Insert: { id?: string; form_id: string; form_version?: number; status?: 'partial' | 'complete'; answers?: unknown; respondent?: unknown; meta?: unknown; task_id?: string | null };
        Update: Partial<Database['public']['Tables']['form_responses']['Insert']>;
        Relationships: [];
      };
      invoices: {
        Row: { id: string; user_id: string; number: string; client_id: string | null; project_id: string | null; status: 'draft' | 'sent' | 'paid' | 'overdue' | 'void'; due_date: string | null; issue_date: string | null; notes: string | null } & Timestamps;
        Insert: { id?: string; user_id: string; number: string; client_id?: string | null; project_id?: string | null; status?: 'draft' | 'sent' | 'paid' | 'overdue' | 'void'; due_date?: string | null; issue_date?: string | null; notes?: string | null };
        Update: Partial<Database['public']['Tables']['invoices']['Insert']>;
        Relationships: [];
      };
      invoice_items: {
        Row: { id: string; invoice_id: string; description: string; quantity: number; unit_amount: number; time_entry_id: string | null; sort_order: number };
        Insert: { id?: string; invoice_id: string; description: string; quantity?: number; unit_amount?: number; time_entry_id?: string | null; sort_order?: number };
        Update: Partial<Database['public']['Tables']['invoice_items']['Insert']>;
        Relationships: [];
      };
      payments: {
        Row: { id: string; user_id: string; invoice_id: string; amount: number; paid_on: string; method: string | null; created_at: string };
        Insert: { id?: string; user_id: string; invoice_id: string; amount: number; paid_on: string; method?: string | null };
        Update: Partial<Database['public']['Tables']['payments']['Insert']>;
        Relationships: [];
      };
      notifications: {
        Row: { id: string; user_id: string; kind: string; title: string; body: string | null; link: Record<string, unknown> | null; read: boolean; created_at: string };
        Insert: { id?: string; user_id: string; kind: string; title: string; body?: string | null; link?: Record<string, unknown> | null; read?: boolean };
        Update: Partial<Database['public']['Tables']['notifications']['Insert']>;
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
}
