export type Country = 'US' | 'UK' | 'AU';

export type CampaignStatus = 'active' | 'paused' | 'archived';

export type ProspectStage =
  | 'new'
  | 'qualified'
  | 'analyzed'
  | 'messaged'
  | 'replied'
  | 'booked'
  | 'won'
  | 'lost'
  | 'unsubscribed';

export const PROSPECT_STAGES: ProspectStage[] = [
  'new',
  'qualified',
  'analyzed',
  'messaged',
  'replied',
  'booked',
  'won',
  'lost',
  'unsubscribed',
];

export const STAGE_LABELS: Record<ProspectStage, string> = {
  new: 'New',
  qualified: 'Qualified',
  analyzed: 'Analyzed',
  messaged: 'Messaged',
  replied: 'Replied',
  booked: 'Booked',
  won: 'Won',
  lost: 'Lost',
  unsubscribed: 'Unsubscribed',
};

export type MessageChannel = 'email' | 'linkedin';

export type MessageStatus = 'draft' | 'approved' | 'sent' | 'opened' | 'replied' | 'bounced';

export type Campaign = {
  id: string;
  owner_id: string;
  name: string;
  niche: string | null;
  target_country: Country | null;
  status: CampaignStatus;
  created_at: string;
}

export type Prospect = {
  id: string;
  owner_id: string;
  campaign_id: string | null;
  name: string;
  company: string | null;
  country: Country | null;
  linkedin_url: string | null;
  website_url: string | null;
  email: string | null;
  email_verified: boolean;
  source: string | null;
  intent_score: number;
  stage: ProspectStage;
  unsubscribed_at: string | null;
  created_at: string;
  updated_at: string;
}

export type FunnelAnalysis = {
  id: string;
  prospect_id: string;
  source_url: string;
  firecrawl_raw: unknown;
  findings_brief: string | null;
  analyzed_at: string;
}

export type Message = {
  id: string;
  prospect_id: string;
  channel: MessageChannel;
  subject: string | null;
  body: string;
  status: MessageStatus;
  resend_message_id: string | null;
  sent_at: string | null;
  created_at: string;
}

export type Activity = {
  id: string;
  prospect_id: string;
  type: string;
  note: string | null;
  created_at: string;
}

export type Settings = {
  id: string;
  owner_id: string;
  sender_name: string | null;
  sender_company: string | null;
  sender_email: string | null;
  mailing_address: string | null;
  daily_send_limit: number;
  firecrawl_api_key: string | null;
  anthropic_api_key: string | null;
  resend_api_key: string | null;
  updated_at: string;
}

export interface Database {
  public: {
    Tables: {
      campaigns: {
        Row: Campaign;
        Insert: Partial<Campaign>;
        Update: Partial<Campaign>;
        Relationships: [];
      };
      prospects: {
        Row: Prospect;
        Insert: Partial<Prospect>;
        Update: Partial<Prospect>;
        Relationships: [];
      };
      funnel_analyses: {
        Row: FunnelAnalysis;
        Insert: Partial<FunnelAnalysis>;
        Update: Partial<FunnelAnalysis>;
        Relationships: [];
      };
      messages: {
        Row: Message;
        Insert: Partial<Message>;
        Update: Partial<Message>;
        Relationships: [];
      };
      activities: {
        Row: Activity;
        Insert: Partial<Activity>;
        Update: Partial<Activity>;
        Relationships: [];
      };
      settings: {
        Row: Settings;
        Insert: Partial<Settings>;
        Update: Partial<Settings>;
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
}
