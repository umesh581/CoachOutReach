-- Outreach Engine initial schema
-- Single-tenant per Supabase auth user, enforced via Row Level Security (RLS).
-- Every top-level table carries owner_id = auth.uid() so the same schema
-- would also support multiple owners later without changes.

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------------------
-- campaigns
-- ---------------------------------------------------------------------------
create table campaigns (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  name text not null,
  niche text,
  target_country text check (target_country in ('US','UK','AU')),
  status text default 'active' check (status in ('active','paused','archived')),
  created_at timestamptz default now()
);

create index campaigns_owner_id_idx on campaigns(owner_id);

alter table campaigns enable row level security;

create policy "campaigns_select_own" on campaigns for select
  using (owner_id = auth.uid());
create policy "campaigns_insert_own" on campaigns for insert
  with check (owner_id = auth.uid());
create policy "campaigns_update_own" on campaigns for update
  using (owner_id = auth.uid()) with check (owner_id = auth.uid());
create policy "campaigns_delete_own" on campaigns for delete
  using (owner_id = auth.uid());

-- ---------------------------------------------------------------------------
-- prospects
-- ---------------------------------------------------------------------------
create table prospects (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  campaign_id uuid references campaigns(id) on delete set null,
  name text not null,
  company text,
  country text check (country in ('US','UK','AU')),
  linkedin_url text,
  website_url text,
  email text,
  email_verified boolean default false,
  source text, -- e.g. 'apollo', 'manual', 'clay'
  intent_score int default 0, -- 0-100, computed from qualification rules
  stage text default 'new' check (stage in ('new','qualified','analyzed','messaged','replied','booked','won','lost','unsubscribed')),
  unsubscribed_at timestamptz,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create index prospects_owner_id_idx on prospects(owner_id);
create index prospects_campaign_id_idx on prospects(campaign_id);
create index prospects_stage_idx on prospects(stage);
-- Case-insensitive de-dup lookups used by CSV import
create index prospects_email_lower_idx on prospects (lower(email));
create index prospects_linkedin_url_idx on prospects (linkedin_url);

alter table prospects enable row level security;

create policy "prospects_select_own" on prospects for select
  using (owner_id = auth.uid());
create policy "prospects_insert_own" on prospects for insert
  with check (owner_id = auth.uid());
create policy "prospects_update_own" on prospects for update
  using (owner_id = auth.uid()) with check (owner_id = auth.uid());
create policy "prospects_delete_own" on prospects for delete
  using (owner_id = auth.uid());

create or replace function set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger prospects_set_updated_at
  before update on prospects
  for each row execute function set_updated_at();

-- ---------------------------------------------------------------------------
-- funnel_analyses
-- ---------------------------------------------------------------------------
create table funnel_analyses (
  id uuid primary key default gen_random_uuid(),
  prospect_id uuid references prospects(id) on delete cascade,
  source_url text not null,
  firecrawl_raw jsonb,
  findings_brief text, -- AI-generated summary of gaps/opportunities
  analyzed_at timestamptz default now()
);

create index funnel_analyses_prospect_id_idx on funnel_analyses(prospect_id);

alter table funnel_analyses enable row level security;

create policy "funnel_analyses_select_own" on funnel_analyses for select
  using (exists (select 1 from prospects p where p.id = prospect_id and p.owner_id = auth.uid()));
create policy "funnel_analyses_insert_own" on funnel_analyses for insert
  with check (exists (select 1 from prospects p where p.id = prospect_id and p.owner_id = auth.uid()));
create policy "funnel_analyses_update_own" on funnel_analyses for update
  using (exists (select 1 from prospects p where p.id = prospect_id and p.owner_id = auth.uid()))
  with check (exists (select 1 from prospects p where p.id = prospect_id and p.owner_id = auth.uid()));
create policy "funnel_analyses_delete_own" on funnel_analyses for delete
  using (exists (select 1 from prospects p where p.id = prospect_id and p.owner_id = auth.uid()));

-- ---------------------------------------------------------------------------
-- messages
-- ---------------------------------------------------------------------------
create table messages (
  id uuid primary key default gen_random_uuid(),
  prospect_id uuid references prospects(id) on delete cascade,
  channel text check (channel in ('email','linkedin')),
  subject text,
  body text not null,
  status text default 'draft' check (status in ('draft','approved','sent','opened','replied','bounced')),
  resend_message_id text,
  sent_at timestamptz,
  created_at timestamptz default now()
);

create index messages_prospect_id_idx on messages(prospect_id);
create index messages_resend_message_id_idx on messages(resend_message_id);

alter table messages enable row level security;

create policy "messages_select_own" on messages for select
  using (exists (select 1 from prospects p where p.id = prospect_id and p.owner_id = auth.uid()));
create policy "messages_insert_own" on messages for insert
  with check (exists (select 1 from prospects p where p.id = prospect_id and p.owner_id = auth.uid()));
create policy "messages_update_own" on messages for update
  using (exists (select 1 from prospects p where p.id = prospect_id and p.owner_id = auth.uid()))
  with check (exists (select 1 from prospects p where p.id = prospect_id and p.owner_id = auth.uid()));
create policy "messages_delete_own" on messages for delete
  using (exists (select 1 from prospects p where p.id = prospect_id and p.owner_id = auth.uid()));

-- ---------------------------------------------------------------------------
-- activities
-- ---------------------------------------------------------------------------
create table activities (
  id uuid primary key default gen_random_uuid(),
  prospect_id uuid references prospects(id) on delete cascade,
  type text not null, -- 'note','stage_change','email_sent','email_opened','email_replied','email_bounced','call_booked','unsubscribed', ...
  note text,
  created_at timestamptz default now()
);

create index activities_prospect_id_idx on activities(prospect_id);

alter table activities enable row level security;

create policy "activities_select_own" on activities for select
  using (exists (select 1 from prospects p where p.id = prospect_id and p.owner_id = auth.uid()));
create policy "activities_insert_own" on activities for insert
  with check (exists (select 1 from prospects p where p.id = prospect_id and p.owner_id = auth.uid()));
create policy "activities_delete_own" on activities for delete
  using (exists (select 1 from prospects p where p.id = prospect_id and p.owner_id = auth.uid()));

-- ---------------------------------------------------------------------------
-- settings (per-owner singleton: API keys, sender identity, compliance info)
-- API keys are only ever read by server-side code (route handlers / server
-- components) and are never returned to client components in full.
-- ---------------------------------------------------------------------------
create table settings (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null unique default auth.uid() references auth.users(id) on delete cascade,
  sender_name text,
  sender_company text,
  sender_email text,
  mailing_address text,
  daily_send_limit int not null default 40,
  firecrawl_api_key text,
  anthropic_api_key text,
  resend_api_key text,
  updated_at timestamptz default now()
);

alter table settings enable row level security;

create policy "settings_select_own" on settings for select
  using (owner_id = auth.uid());
create policy "settings_insert_own" on settings for insert
  with check (owner_id = auth.uid());
create policy "settings_update_own" on settings for update
  using (owner_id = auth.uid()) with check (owner_id = auth.uid());

create trigger settings_set_updated_at
  before update on settings
  for each row execute function set_updated_at();
