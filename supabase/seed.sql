-- Optional sample data for manually testing the Units & Rates module.
-- Run after the migrations in supabase/migrations/, once you also have at
-- least one authenticated user (auth signs up -> profiles row appears
-- automatically via the 0005_profile_provisioning.sql trigger).

insert into units (name, unit_type, max_capacity, nightly_rate, amenities, status) values
  ('Room 101', 'Standard Room', 2, 1800.00, array['Wi-Fi', 'Aircon'], 'AVAILABLE'),
  ('Room 102', 'Standard Room', 2, 1800.00, array['Wi-Fi', 'Aircon'], 'OCCUPIED'),
  ('Room 201', 'Deluxe Room', 3, 2500.00, array['Wi-Fi', 'Aircon', 'TV', 'Balcony'], 'DIRTY'),
  ('Family Suite', 'Suite', 5, 4200.00, array['Wi-Fi', 'Aircon', 'TV', 'Kitchenette'], 'AVAILABLE'),
  ('Room 202', 'Deluxe Room', 3, 2500.00, array['Wi-Fi', 'Aircon', 'TV'], 'MAINTENANCE');
