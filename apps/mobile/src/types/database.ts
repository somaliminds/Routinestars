/**
 * Supabase TypeScript types — placeholder until Sprint 1.3 runs:
 *   npx supabase gen types typescript --project-id ujzsteariqmqizzraccw > src/types/database.ts
 *
 * All tables include Relationships: [] as required by @supabase/postgrest-js GenericTable.
 */

export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type Database = {
  public: {
    Tables: {
      users: {
        Row: {
          user_id: string;
          name: string;
          role: 'child' | 'parent';
          avatar_url: string | null;
          created_at: string;
        };
        Insert: {
          user_id?: string;
          name: string;
          role: 'child' | 'parent';
          avatar_url?: string | null;
          created_at?: string;
        };
        Update: { name?: string; role?: 'child' | 'parent'; avatar_url?: string | null };
        Relationships: [];
      };
      child_profiles: {
        Row: {
          profile_id: string;
          user_id: string | null;
          parent_id: string;
          child_name: string;
          date_of_birth: string;
          avatar_emoji: string;
          total_stars: number;
          current_streak: number;
          first_then_mode: boolean;
        };
        Insert: {
          profile_id?: string;
          user_id?: string | null;
          parent_id: string;
          child_name: string;
          date_of_birth: string;
          avatar_emoji?: string;
          total_stars?: number;
          current_streak?: number;
          first_then_mode?: boolean;
        };
        Update: {
          user_id?: string | null;
          parent_id?: string;
          child_name?: string;
          date_of_birth?: string;
          avatar_emoji?: string;
          total_stars?: number;
          current_streak?: number;
          first_then_mode?: boolean;
        };
        Relationships: [];
      };
      parent_profiles: {
        Row: {
          profile_id: string;
          user_id: string;
          pin_hash: string;
          notify_on_completion: boolean;
          notify_on_request: boolean;
          notify_transition_warnings: boolean;
          ai_routine_gen_enabled: boolean;
          expo_push_token: string | null;
        };
        Insert: {
          profile_id?: string;
          user_id: string;
          pin_hash: string;
          notify_on_completion?: boolean;
          notify_on_request?: boolean;
          notify_transition_warnings?: boolean;
          ai_routine_gen_enabled?: boolean;
          expo_push_token?: string | null;
        };
        Update: {
          pin_hash?: string;
          notify_on_completion?: boolean;
          notify_on_request?: boolean;
          notify_transition_warnings?: boolean;
          ai_routine_gen_enabled?: boolean;
          expo_push_token?: string | null;
        };
        Relationships: [];
      };
      activity_sets: {
        Row: {
          set_id: string;
          set_name: string;
          category: string;
          icon_emoji: string;
          colour_theme: string;
          total_duration_mins: number;
          requires_approval: boolean;
          is_custom: boolean;
          created_by_parent_id: string | null;
          created_at: string;
        };
        Insert: {
          set_id?: string;
          set_name: string;
          category: string;
          icon_emoji?: string;
          colour_theme?: string;
          total_duration_mins?: number;
          requires_approval?: boolean;
          is_custom?: boolean;
          created_by_parent_id?: string | null;
        };
        Update: {
          set_name?: string;
          category?: string;
          icon_emoji?: string;
          colour_theme?: string;
          total_duration_mins?: number;
          requires_approval?: boolean;
        };
        Relationships: [];
      };
      steps: {
        Row: {
          step_id: string;
          set_id: string;
          order_index: number;
          title: string;
          instruction_text: string;
          audio_url: string | null;
          illustration_url: string | null;
          duration_seconds: number;
          reward_stars: number;
        };
        Insert: {
          step_id?: string;
          set_id: string;
          order_index: number;
          title: string;
          instruction_text: string;
          audio_url?: string | null;
          illustration_url?: string | null;
          duration_seconds?: number;
          reward_stars?: number;
        };
        Update: {
          order_index?: number;
          title?: string;
          instruction_text?: string;
          audio_url?: string | null;
          illustration_url?: string | null;
          duration_seconds?: number;
          reward_stars?: number;
        };
        Relationships: [];
      };
      day_schedules: {
        Row: {
          schedule_id: string;
          child_id: string;
          day_of_week: number;
          schedule_date: string;
          is_weekend: boolean;
          is_published: boolean;
          created_by: string;
          created_at: string;
        };
        Insert: {
          schedule_id?: string;
          child_id: string;
          day_of_week: number;
          schedule_date: string;
          is_weekend?: boolean;
          is_published?: boolean;
          created_by: string;
        };
        Update: {
          day_of_week?: number;
          schedule_date?: string;
          is_weekend?: boolean;
          is_published?: boolean;
        };
        Relationships: [];
      };
      scheduled_sets: {
        Row: {
          scheduled_set_id: string;
          schedule_id: string;
          set_id: string;
          order_in_day: number;
          start_time: string;
          end_time: string;
          status: ScheduledSetStatus;
          updated_at: string;
        };
        Insert: {
          scheduled_set_id?: string;
          schedule_id: string;
          set_id: string;
          order_in_day: number;
          start_time: string;
          end_time: string;
          status?: ScheduledSetStatus;
        };
        Update: {
          order_in_day?: number;
          start_time?: string;
          end_time?: string;
          status?: ScheduledSetStatus;
        };
        Relationships: [];
      };
      completions: {
        Row: {
          completion_id: string;
          scheduled_set_id: string;
          child_id: string;
          started_at: string;
          completed_at: string | null;
          stars_earned: number;
          parent_approved: boolean;
          approved_at: string | null;
          approved_by: string | null;
          environment: 'HOME' | 'SCHOOL' | 'RESPITE';
          carer_user_id: string | null;
          carer_note: string | null;
        };
        Insert: {
          completion_id?: string;
          scheduled_set_id: string;
          child_id: string;
          started_at?: string;
          completed_at?: string | null;
          stars_earned?: number;
          parent_approved?: boolean;
          approved_at?: string | null;
          approved_by?: string | null;
          environment?: 'HOME' | 'SCHOOL' | 'RESPITE';
          carer_user_id?: string | null;
          carer_note?: string | null;
        };
        Update: {
          completed_at?: string | null;
          stars_earned?: number;
          parent_approved?: boolean;
          approved_at?: string | null;
          approved_by?: string | null;
          environment?: 'HOME' | 'SCHOOL' | 'RESPITE';
          carer_user_id?: string | null;
          carer_note?: string | null;
        };
        Relationships: [];
      };
      step_completions: {
        Row: {
          step_comp_id: string;
          completion_id: string;
          step_id: string;
          completed_at: string;
          time_taken_seconds: number;
        };
        Insert: {
          step_comp_id?: string;
          completion_id: string;
          step_id: string;
          completed_at?: string;
          time_taken_seconds?: number;
        };
        Update: { time_taken_seconds?: number };
        Relationships: [];
      };
      rewards: {
        Row: {
          reward_id: string;
          type: 'STAR' | 'BADGE' | 'TROPHY' | 'STREAK_BONUS';
          name: string;
          icon_url: string | null;
          description: string;
          stars_required: number;
        };
        Insert: {
          reward_id?: string;
          type: 'STAR' | 'BADGE' | 'TROPHY' | 'STREAK_BONUS';
          name: string;
          icon_url?: string | null;
          description: string;
          stars_required?: number;
        };
        Update: {
          name?: string;
          icon_url?: string | null;
          description?: string;
          stars_required?: number;
        };
        Relationships: [];
      };
      child_rewards: {
        Row: { child_reward_id: string; child_id: string; reward_id: string; earned_at: string };
        Insert: {
          child_reward_id?: string;
          child_id: string;
          reward_id: string;
          earned_at?: string;
        };
        Update: { earned_at?: string };
        Relationships: [];
      };
      lockout_events: {
        Row: {
          lockout_id: string;
          child_id: string;
          scheduled_set_id: string;
          locked_at: string;
          unlocked_at: string | null;
          unlocked_by: string | null;
        };
        Insert: {
          lockout_id?: string;
          child_id: string;
          scheduled_set_id: string;
          locked_at?: string;
          unlocked_at?: string | null;
          unlocked_by?: string | null;
        };
        Update: { unlocked_at?: string | null; unlocked_by?: string | null };
        Relationships: [];
      };
      notifications: {
        Row: {
          notif_id: string;
          recipient_user_id: string;
          type: 'APPROVAL_REQUEST' | 'SET_COMPLETE' | 'BADGE_EARNED';
          message: string;
          sent_at: string;
          is_read: boolean;
        };
        Insert: {
          notif_id?: string;
          recipient_user_id: string;
          type: 'APPROVAL_REQUEST' | 'SET_COMPLETE' | 'BADGE_EARNED';
          message: string;
          sent_at?: string;
          is_read?: boolean;
        };
        Update: { is_read?: boolean };
        Relationships: [];
      };
      subscriptions: {
        Row: {
          subscription_id: string;
          user_id: string;
          stripe_customer_id: string | null;
          stripe_subscription_id: string | null;
          plan: 'FREE' | 'STARTER' | 'FAMILY' | 'SCHOOL';
          status: 'active' | 'trialing' | 'past_due' | 'canceled' | 'incomplete';
          current_period_end: string | null;
          cancel_at_period_end: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          subscription_id?: string;
          user_id: string;
          stripe_customer_id?: string | null;
          stripe_subscription_id?: string | null;
          plan?: 'FREE' | 'STARTER' | 'FAMILY' | 'SCHOOL';
          status?: 'active' | 'trialing' | 'past_due' | 'canceled' | 'incomplete';
          current_period_end?: string | null;
          cancel_at_period_end?: boolean;
        };
        Update: {
          stripe_customer_id?: string | null;
          stripe_subscription_id?: string | null;
          plan?: 'FREE' | 'STARTER' | 'FAMILY' | 'SCHOOL';
          status?: 'active' | 'trialing' | 'past_due' | 'canceled' | 'incomplete';
          current_period_end?: string | null;
          cancel_at_period_end?: boolean;
          updated_at?: string;
        };
        Relationships: [];
      };
      care_team_members: {
        Row: {
          member_id: string;
          parent_id: string;
          child_id: string;
          email: string;
          role: 'view_only' | 'approver' | 'school_ta';
          environment: 'HOME' | 'SCHOOL' | 'RESPITE';
          invited_at: string;
          accepted_at: string | null;
        };
        Insert: {
          member_id?: string;
          parent_id: string;
          child_id: string;
          email: string;
          role: 'view_only' | 'approver' | 'school_ta';
          environment?: 'HOME' | 'SCHOOL' | 'RESPITE';
          invited_at?: string;
          accepted_at?: string | null;
        };
        Update: {
          role?: 'view_only' | 'approver' | 'school_ta';
          environment?: 'HOME' | 'SCHOOL' | 'RESPITE';
          accepted_at?: string | null;
        };
        Relationships: [];
      };
      emotional_checkins: {
        Row: {
          checkin_id: string;
          child_id: string;
          zone: 'BLUE' | 'GREEN' | 'YELLOW' | 'RED';
          context: string | null;
          occurred_at: string;
          created_at: string;
        };
        Insert: {
          checkin_id?: string;
          child_id: string;
          zone: 'BLUE' | 'GREEN' | 'YELLOW' | 'RED';
          context?: string | null;
          occurred_at?: string;
          created_at?: string;
        };
        Update: {
          zone?: 'BLUE' | 'GREEN' | 'YELLOW' | 'RED';
          context?: string | null;
          occurred_at?: string;
        };
        Relationships: [];
      };
      activity_set_outcome_tags: {
        Row: {
          tag_id: string;
          set_id: string;
          outcome_id: string;
          tagged_at: string;
        };
        Insert: {
          tag_id?: string;
          set_id: string;
          outcome_id: string;
          tagged_at?: string;
        };
        Update: {
          set_id?: string;
          outcome_id?: string;
        };
        Relationships: [];
      };
      ehcp_outcomes: {
        Row: {
          outcome_id: string;
          child_id: string;
          outcome_text: string;
          category:
            | 'COMMUNICATION'
            | 'COGNITION'
            | 'SOCIAL_EMOTIONAL'
            | 'SENSORY_PHYSICAL'
            | 'INDEPENDENCE'
            | 'OTHER';
          target_date: string | null;
          status: 'ACTIVE' | 'ACHIEVED' | 'DISCONTINUED';
          notes: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          outcome_id?: string;
          child_id: string;
          outcome_text: string;
          category:
            | 'COMMUNICATION'
            | 'COGNITION'
            | 'SOCIAL_EMOTIONAL'
            | 'SENSORY_PHYSICAL'
            | 'INDEPENDENCE'
            | 'OTHER';
          target_date?: string | null;
          status?: 'ACTIVE' | 'ACHIEVED' | 'DISCONTINUED';
          notes?: string | null;
        };
        Update: {
          outcome_text?: string;
          category?:
            | 'COMMUNICATION'
            | 'COGNITION'
            | 'SOCIAL_EMOTIONAL'
            | 'SENSORY_PHYSICAL'
            | 'INDEPENDENCE'
            | 'OTHER';
          target_date?: string | null;
          status?: 'ACTIVE' | 'ACHIEVED' | 'DISCONTINUED';
          notes?: string | null;
        };
        Relationships: [];
      };
      annual_reviews: {
        Row: {
          review_id: string;
          child_id: string;
          ehcp_date_issued: string | null;
          review_date: string | null;
          review_chair: string | null;
          attendees: string | null;
          parent_strengths: string | null;
          parent_progress: string | null;
          parent_concerns: string | null;
          parent_aspirations: string | null;
          parent_requested_changes: string | null;
          child_communication_method: string | null;
          child_how_i_feel: string | null;
          child_going_well: string | null;
          child_difficult: string | null;
          child_want_to_change: string | null;
          child_goals: string | null;
          recommendation: 'MAINTAIN' | 'AMEND' | 'CEASE' | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          review_id?: string;
          child_id: string;
          ehcp_date_issued?: string | null;
          review_date?: string | null;
          review_chair?: string | null;
          attendees?: string | null;
          parent_strengths?: string | null;
          parent_progress?: string | null;
          parent_concerns?: string | null;
          parent_aspirations?: string | null;
          parent_requested_changes?: string | null;
          child_communication_method?: string | null;
          child_how_i_feel?: string | null;
          child_going_well?: string | null;
          child_difficult?: string | null;
          child_want_to_change?: string | null;
          child_goals?: string | null;
          recommendation?: 'MAINTAIN' | 'AMEND' | 'CEASE' | null;
        };
        Update: {
          ehcp_date_issued?: string | null;
          review_date?: string | null;
          review_chair?: string | null;
          attendees?: string | null;
          parent_strengths?: string | null;
          parent_progress?: string | null;
          parent_concerns?: string | null;
          parent_aspirations?: string | null;
          parent_requested_changes?: string | null;
          child_communication_method?: string | null;
          child_how_i_feel?: string | null;
          child_going_well?: string | null;
          child_difficult?: string | null;
          child_want_to_change?: string | null;
          child_goals?: string | null;
          recommendation?: 'MAINTAIN' | 'AMEND' | 'CEASE' | null;
        };
        Relationships: [];
      };
      apdr_cycles: {
        Row: {
          cycle_id: string;
          outcome_id: string;
          child_id: string;
          cycle_number: number;
          window_from: string | null;
          window_to: string | null;
          assess_notes: string | null;
          plan_target: string | null;
          plan_provision: string | null;
          do_notes: string | null;
          review_progress: string | null;
          review_decision: 'CONTINUE' | 'MODIFY' | 'ESCALATE' | null;
          status: 'ASSESS' | 'PLAN' | 'DO' | 'REVIEW' | 'COMPLETE';
          created_at: string;
          updated_at: string;
        };
        Insert: {
          cycle_id?: string;
          outcome_id: string;
          child_id: string;
          cycle_number?: number;
          window_from?: string | null;
          window_to?: string | null;
          assess_notes?: string | null;
          plan_target?: string | null;
          plan_provision?: string | null;
          do_notes?: string | null;
          review_progress?: string | null;
          review_decision?: 'CONTINUE' | 'MODIFY' | 'ESCALATE' | null;
          status?: 'ASSESS' | 'PLAN' | 'DO' | 'REVIEW' | 'COMPLETE';
        };
        Update: {
          cycle_number?: number;
          window_from?: string | null;
          window_to?: string | null;
          assess_notes?: string | null;
          plan_target?: string | null;
          plan_provision?: string | null;
          do_notes?: string | null;
          review_progress?: string | null;
          review_decision?: 'CONTINUE' | 'MODIFY' | 'ESCALATE' | null;
          status?: 'ASSESS' | 'PLAN' | 'DO' | 'REVIEW' | 'COMPLETE';
        };
        Relationships: [];
      };
      consent_records: {
        Row: {
          consent_id: string;
          child_id: string;
          consent_given_by: string;
          relationship: 'parent' | 'guardian';
          consent_date: string;
          professional_id: string | null;
          professional_email: string;
          professional_role: string;
          professional_org: string | null;
          data_categories: string[];
          purpose: string | null;
          expiry_date: string;
          withdrawn_at: string | null;
          withdrawn_by: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          consent_id?: string;
          child_id: string;
          consent_given_by: string;
          relationship?: 'parent' | 'guardian';
          consent_date?: string;
          professional_id?: string | null;
          professional_email: string;
          professional_role: string;
          professional_org?: string | null;
          data_categories?: string[];
          purpose?: string | null;
          expiry_date: string;
          withdrawn_at?: string | null;
          withdrawn_by?: string | null;
        };
        Update: {
          professional_id?: string | null;
          professional_role?: string;
          professional_org?: string | null;
          data_categories?: string[];
          purpose?: string | null;
          expiry_date?: string;
          withdrawn_at?: string | null;
          withdrawn_by?: string | null;
        };
        Relationships: [];
      };
      access_audit_log: {
        Row: {
          event_id: string;
          occurred_at: string;
          actor_id: string;
          actor_role: string | null;
          child_id: string;
          data_categories: string[];
          action: 'VIEW' | 'CONTRIBUTE' | 'EXPORT';
          purpose: string | null;
          lawful_basis: string | null;
          consent_id: string | null;
          decision_rationale: string | null;
        };
        Insert: {
          event_id?: string;
          occurred_at?: string;
          actor_id: string;
          actor_role?: string | null;
          child_id: string;
          data_categories?: string[];
          action: 'VIEW' | 'CONTRIBUTE' | 'EXPORT';
          purpose?: string | null;
          lawful_basis?: string | null;
          consent_id?: string | null;
          decision_rationale?: string | null;
        };
        Update: Record<string, never>;
        Relationships: [];
      };
      professional_contributions: {
        Row: {
          contribution_id: string;
          child_id: string;
          outcome_id: string | null;
          author_id: string;
          author_role: string | null;
          author_email: string | null;
          kind: 'ADVICE' | 'TARGET' | 'NOTE';
          content: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          contribution_id?: string;
          child_id: string;
          outcome_id?: string | null;
          author_id: string;
          author_role?: string | null;
          author_email?: string | null;
          kind?: 'ADVICE' | 'TARGET' | 'NOTE';
          content: string;
        };
        Update: {
          outcome_id?: string | null;
          kind?: 'ADVICE' | 'TARGET' | 'NOTE';
          content?: string;
        };
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: {
      increment_child_stars: {
        Args: { p_child_id: string; p_stars: number };
        Returns: undefined;
      };
      accept_my_care_team_invitations: {
        Args: Record<string, never>;
        Returns: undefined;
      };
      accept_professional_consents: {
        Args: Record<string, never>;
        Returns: number;
      };
    };
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
};

// ── Convenience Row Types ────────────────────────────────────────────────────
export type UserRow = Database['public']['Tables']['users']['Row'];
export type ChildProfileRow = Database['public']['Tables']['child_profiles']['Row'];
export type ParentProfileRow = Database['public']['Tables']['parent_profiles']['Row'];
export type ActivitySetRow = Database['public']['Tables']['activity_sets']['Row'];
export type StepRow = Database['public']['Tables']['steps']['Row'];
export type DayScheduleRow = Database['public']['Tables']['day_schedules']['Row'];
export type ScheduledSetRow = Database['public']['Tables']['scheduled_sets']['Row'];
export type CompletionRow = Database['public']['Tables']['completions']['Row'];
export type StepCompletionRow = Database['public']['Tables']['step_completions']['Row'];
export type RewardRow = Database['public']['Tables']['rewards']['Row'];
export type ChildRewardRow = Database['public']['Tables']['child_rewards']['Row'];
export type LockoutEventRow = Database['public']['Tables']['lockout_events']['Row'];
export type NotificationRow = Database['public']['Tables']['notifications']['Row'];
export type CareTeamMemberRow = Database['public']['Tables']['care_team_members']['Row'];
export type SubscriptionRow = Database['public']['Tables']['subscriptions']['Row'];
export type EmotionalCheckinRow = Database['public']['Tables']['emotional_checkins']['Row'];
export type Zone = EmotionalCheckinRow['zone'];
export type EhcpOutcomeRow = Database['public']['Tables']['ehcp_outcomes']['Row'];
export type EhcpCategory = EhcpOutcomeRow['category'];
export type EhcpStatus = EhcpOutcomeRow['status'];
export type ActivitySetOutcomeTagRow =
  Database['public']['Tables']['activity_set_outcome_tags']['Row'];
export type CareTeamRole = CareTeamMemberRow['role'];
export type Environment = CareTeamMemberRow['environment'];

export type ScheduledSetStatus =
  | 'PENDING'
  | 'IN_PROGRESS'
  | 'PAUSED'
  | 'AWAITING_APPROVAL'
  | 'APPROVED'
  | 'LOCKED'
  | 'SKIPPED';
