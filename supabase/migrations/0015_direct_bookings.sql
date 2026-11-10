-- Portfolio Analytics: direct bookings and booking sources.
--
-- Hosts also take bookings outside the OTAs — through Facebook, Instagram,
-- TikTok, Messenger, referrals or walk-ins. Those are typed in on the
-- Direct bookings page and stored as ordinary an_transactions rows with
-- channel = 'direct' (no import file, so import_id is null), linked to a
-- per-unit 'direct' listing so every report treats them like any other stay.
--
-- source records where a booking came from. Direct bookings always have one;
-- CSV imports can map a "Source" column; OTA rows fall back to their channel.

alter table an_listings drop constraint if exists an_listings_channel_check;
alter table an_listings add constraint an_listings_channel_check
  check (channel in ('airbnb', 'booking', 'agoda', 'other', 'direct'));

alter table an_transactions drop constraint if exists an_transactions_channel_check;
alter table an_transactions add constraint an_transactions_channel_check
  check (channel in ('airbnb', 'booking', 'agoda', 'other', 'direct'));

alter table an_transactions alter column import_id drop not null;
alter table an_transactions add column if not exists source text
  check (source is null or char_length(source) between 1 and 40);
alter table an_transactions add column if not exists payment_method text
  check (payment_method is null or char_length(payment_method) between 1 and 40);
alter table an_transactions add column if not exists notes text
  check (notes is null or char_length(notes) <= 1000);

create index if not exists an_transactions_direct_idx
  on an_transactions (workspace_id, check_in)
  where channel = 'direct';

-- Manual rows have no import; only check the import when there is one.
create or replace function an_guard_transaction_refs()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.import_id is not null then
    if not exists (
      select 1 from an_imports where id = new.import_id and workspace_id = new.workspace_id
    ) then
      raise exception 'Import belongs to another workspace';
    end if;
  end if;
  if new.listing_id is not null then
    if not exists (
      select 1 from an_listings where id = new.listing_id and workspace_id = new.workspace_id
    ) then
      raise exception 'Listing belongs to another workspace';
    end if;
  end if;
  return new;
end;
$$;

revoke execute on function an_guard_transaction_refs() from public, anon, authenticated;
