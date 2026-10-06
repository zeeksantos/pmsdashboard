-- Chinese New Year and All Souls' Day: special non-working holidays.
-- 2026 dates are the proclaimed ones (Proclamation No. 1006, s. 2025).
-- 2027 dates are tentative until proclaimed; remove or re-add them if they change.
insert into company_events (title, kind, start_date, end_date, note) values
  ('Chinese New Year', 'SPECIAL_HOLIDAY', '2026-02-17', '2026-02-17', 'Proclamation No. 1006, s. 2025'),
  ('All Souls'' Day', 'SPECIAL_HOLIDAY', '2026-11-02', '2026-11-02', 'Proclamation No. 1006, s. 2025'),
  ('Chinese New Year', 'SPECIAL_HOLIDAY', '2027-02-06', '2027-02-06', 'Tentative: not proclaimed yet. Remove and re-add it if the date changes.'),
  ('All Souls'' Day', 'SPECIAL_HOLIDAY', '2027-11-02', '2027-11-02', 'Tentative: not proclaimed yet. Remove it if it is not declared a holiday.')
on conflict do nothing;
