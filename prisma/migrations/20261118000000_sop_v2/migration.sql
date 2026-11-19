-- New Outlet Launch SOP v2: expected key date (MOU point 11) and the T-7 intimation marker.
-- No new tables (no Data API grants needed).
ALTER TABLE "stores" ADD COLUMN "expected_key_date" DATE, ADD COLUMN "pre_key_notified_for" DATE;
