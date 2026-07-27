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
          preferences: { accent?: string; density?: 'comfortable' | 'compact'; displayFont?: string };
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
        Row: { id: string; user_id: string; space_id: string; client_id: string | null; name: string; color: string | null; status: string; deadline: string | null; deadline_label: string | null; portal_enabled: boolean; portal_token: string | null; share_progress: boolean; share_completed_tasks: boolean; share_open_tasks: boolean; share_timeline: boolean; share_files: boolean; share_invoices: boolean; allow_requests: boolean; portal_intro: string | null } & Timestamps;
        Insert: { id?: string; user_id: string; space_id: string; client_id?: string | null; name: string; color?: string | null; status?: string; deadline?: string | null; deadline_label?: string | null; portal_enabled?: boolean; portal_token?: string | null; share_progress?: boolean; share_completed_tasks?: boolean; share_open_tasks?: boolean; share_timeline?: boolean; share_files?: boolean; share_invoices?: boolean; allow_requests?: boolean; portal_intro?: string | null };
        Update: Partial<Database['public']['Tables']['projects']['Insert']>;
        Relationships: [];
      };
      project_activity: {
        Row: { id: string; project_id: string; user_id: string; type: string; body: string | null; created_at: string };
        Insert: { id?: string; project_id: string; user_id: string; type: string; body?: string | null };
        Update: Partial<Database['public']['Tables']['project_activity']['Insert']>;
        Relationships: [];
      };
      goals: {
        Row: { id: string; user_id: string; space_id: string; project_id: string | null; title: string; note: string | null; horizon: Horizon; cadence: 'weekly' | 'monthly'; progress: number; behind: boolean; last_reviewed: string | null; target_date: string | null; status: string } & Timestamps;
        Insert: { id?: string; user_id: string; space_id: string; project_id?: string | null; title: string; note?: string | null; horizon?: Horizon; cadence?: 'weekly' | 'monthly'; progress?: number; behind?: boolean; last_reviewed?: string | null; target_date?: string | null; status?: string };
        Update: Partial<Database['public']['Tables']['goals']['Insert']>;
        Relationships: [];
      };
      milestones: {
        Row: { id: string; user_id: string; goal_id: string; title: string; done: boolean; sort_order: number } & Timestamps;
        Insert: { id?: string; user_id: string; goal_id: string; title: string; done?: boolean; sort_order?: number };
        Update: Partial<Database['public']['Tables']['milestones']['Insert']>;
        Relationships: [];
      };
      tasks: {
        Row: {
          id: string; user_id: string; space_id: string; project_id: string | null; goal_id: string | null;
          parent_task_id: string | null; title: string; notes: string | null; priority: Priority; done: boolean;
          highlight: boolean; scheduled_date: string | null; due_date: string | null; is_inbox: boolean; estimate_minutes: number | null;
          elapsed_minutes: number; recurrence: Record<string, unknown> | null; completed_at: string | null; sort_order: number; client_visible: boolean; status: string | null; section_id: string | null; request_id: string | null;
        } & Timestamps;
        Insert: {
          id?: string; user_id: string; space_id: string; project_id?: string | null; goal_id?: string | null;
          parent_task_id?: string | null; title: string; notes?: string | null; priority?: Priority; done?: boolean;
          highlight?: boolean; scheduled_date?: string | null; due_date?: string | null; is_inbox?: boolean; estimate_minutes?: number | null;
          elapsed_minutes?: number; recurrence?: Record<string, unknown> | null; completed_at?: string | null; sort_order?: number; client_visible?: boolean; status?: string | null; section_id?: string | null; request_id?: string | null;
        };
        Update: Partial<Database['public']['Tables']['tasks']['Insert']>;
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
      sections: {
        Row: { id: string; user_id: string; project_id: string; name: string; sort_order: number; created_at: string };
        Insert: { id?: string; user_id: string; project_id: string; name: string; sort_order?: number };
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
        Row: { id: string; user_id: string; space_id: string | null; title: string; cadence: string; active: boolean; created_at: string; time_of_day: string; goal_target: number; goal_period: string; sort_order: number; archived: boolean; color: string | null };
        Insert: { id?: string; user_id: string; space_id?: string | null; title: string; cadence?: string; active?: boolean; time_of_day?: string; goal_target?: number; goal_period?: string; sort_order?: number; archived?: boolean; color?: string | null };
        Update: Partial<Database['public']['Tables']['habits']['Insert']>;
        Relationships: [];
      };
      habit_logs: {
        Row: { id: string; user_id: string; habit_id: string; log_date: string; done: boolean; status: string };
        Insert: { id?: string; user_id: string; habit_id: string; log_date: string; done?: boolean; status?: string };
        Update: Partial<Database['public']['Tables']['habit_logs']['Insert']>;
        Relationships: [];
      };
      calendar_events: {
        Row: { id: string; user_id: string; space_id: string | null; title: string; starts_at: string; ends_at: string | null; all_day: boolean; source: string; external_id: string | null; created_at: string };
        Insert: { id?: string; user_id: string; space_id?: string | null; title: string; starts_at: string; ends_at?: string | null; all_day?: boolean; source?: string; external_id?: string | null };
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
        Row: { id: string; user_id: string; space_id: string; folder_id: string | null; project_id: string | null; title: string | null; type: string; content: Record<string, unknown>; tags: string[]; is_daily: boolean; daily_date: string | null; client_visible: boolean; parent_id: string | null; client_id: string | null; icon: string | null; cover: string | null; is_pinned: boolean; is_favorite: boolean; archived_at: string | null; sort_index: number } & Timestamps;
        Insert: { id?: string; user_id: string; space_id: string; folder_id?: string | null; project_id?: string | null; title?: string | null; type?: string; content?: Record<string, unknown>; tags?: string[]; is_daily?: boolean; daily_date?: string | null; client_visible?: boolean; parent_id?: string | null; client_id?: string | null; icon?: string | null; cover?: string | null; is_pinned?: boolean; is_favorite?: boolean; archived_at?: string | null; sort_index?: number };
        Update: Partial<Database['public']['Tables']['pages']['Insert']>;
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
