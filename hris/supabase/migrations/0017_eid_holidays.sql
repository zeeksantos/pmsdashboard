-- Eid'l Fitr and Eid'l Adha (regular holidays; the date is proclaimed each year).
-- 2026 dates are the proclaimed ones (Proclamation Nos. 1189 and 1264, s. 2026).
-- 2027 dates are tentative until proclaimed; remove and re-add them if they change.
insert into company_events (title, kind, start_date, end_date, note) values
  ('Eid''l Fitr (Feast of Ramadhan)', 'REGULAR_HOLIDAY', '2026-03-20', '2026-03-20', 'Proclamation No. 1189, s. 2026'),
  ('Eid''l Adha (Feast of Sacrifice)', 'REGULAR_HOLIDAY', '2026-05-27', '2026-05-27', 'Proclamation No. 1264, s. 2026'),
  ('Eid''l Fitr (Feast of Ramadhan)', 'REGULAR_HOLIDAY', '2027-03-10', '2027-03-10', 'Tentative: the date is set by proclamation. Remove and re-add it if the date changes.'),
  ('Eid''l Adha (Feast of Sacrifice)', 'REGULAR_HOLIDAY', '2027-05-17', '2027-05-17', 'Tentative: the date is set by proclamation. Remove and re-add it if the date changes.')
on conflict do nothing;
