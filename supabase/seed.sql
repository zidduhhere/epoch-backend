-- DO NOT RUN. Legacy file kept for history only. It opens or overwrites live data.
-- Use phone-login-migration.sql and the later migrations instead.
-- ==============================================================================
-- SEED DATA: 4 Years of Classes, Coordinators, Students, Ledger & Bills
-- ==============================================================================

-- 1. INSERT CLASSES (Across all 4 years with 2 coordinators assigned each)
insert into public.classes (id, year, branch, section, target_per_student, coordinator_1_name, coordinator_1_phone, coordinator_2_name, coordinator_2_phone)
values
  -- Year 1
  ('11111111-1111-1111-1111-111111111101', 1, 'CSE', 'A', 2600.00, 'Aarav Sharma', '+91 98765 43210', 'Diya Patel', '+91 98765 43211'),
  ('11111111-1111-1111-1111-111111111102', 1, 'ECE', 'A', 2600.00, 'Rohan Verma', '+91 98765 43212', 'Ananya Gupta', '+91 98765 43213'),
  -- Year 2
  ('22222222-2222-2222-2222-222222222201', 2, 'CSE', 'B', 2600.00, 'Karthik Nair', '+91 98765 43214', 'Sneha Rao', '+91 98765 43215'),
  ('22222222-2222-2222-2222-222222222202', 2, 'MECH', 'A', 2600.00, 'Vikram Singh', '+91 98765 43216', 'Pooja Hegde', '+91 98765 43217'),
  -- Year 3
  ('33333333-3333-3333-3333-333333333301', 3, 'CSE', 'A', 2600.00, 'Aditya Menon', '+91 98765 43218', 'Meera Krishnan', '+91 98765 43219'),
  ('33333333-3333-3333-3333-333333333302', 3, 'IT', 'A', 2600.00, 'Rahul Joshi', '+91 98765 43220', 'Tanvi Deshmukh', '+91 98765 43221'),
  -- Year 4
  ('44444444-4444-4444-4444-444444444401', 4, 'CSE', 'A', 2600.00, 'Nikhil Pillai', '+91 98765 43222', 'Rhea Thomas', '+91 98765 43223'),
  ('44444444-4444-4444-4444-444444444402', 4, 'CIVIL', 'A', 2600.00, 'Siddharth Iyer', '+91 98765 43224', 'Kavya Nambiar', '+91 98765 43225')
on conflict (year, branch, section) do update 
set coordinator_1_name = excluded.coordinator_1_name,
    coordinator_1_phone = excluded.coordinator_1_phone,
    coordinator_2_name = excluded.coordinator_2_name,
    coordinator_2_phone = excluded.coordinator_2_phone;

-- 2. INSERT SAMPLE STUDENTS FOR YEAR 3 - CSE A
insert into public.students (id, class_id, roll_number, name, phone, amount_due, amount_paid, payment_mode, reference_id, notes, rep_handover_verified, treasurer_verified, updated_by_name, updated_by_role)
values
  ('aaaaaaaa-0001-0000-0000-000000000001', '33333333-3333-3333-3333-333333333301', '3CSE01', 'Abhishek Kumar', '+91 91234 56701', 2600.00, 2600.00, 'upi', 'UPI/2026/0912443', 'Paid full via Google Pay', false, false, 'Elena Vance', 'admin'),
  ('aaaaaaaa-0002-0000-0000-000000000002', '33333333-3333-3333-3333-333333333301', '3CSE02', 'Bhavna Sen', '+91 91234 56702', 2600.00, 2600.00, 'cash', 'REC-Y3-04', 'Handed cash to Aditya', true, true, 'Elena Vance', 'admin'),
  ('aaaaaaaa-0003-0000-0000-000000000003', '33333333-3333-3333-3333-333333333301', '3CSE03', 'Chirag Reddy', '+91 91234 56703', 2600.00, 1300.00, 'upi', 'UPI/2026/0889123', 'Part 1 paid, Part 2 next Monday', false, false, 'Aditya Menon', 'class_rep'),
  ('aaaaaaaa-0004-0000-0000-000000000004', '33333333-3333-3333-3333-333333333301', '3CSE04', 'Deepika Sundaram', '+91 91234 56704', 2600.00, 0.00, 'cash', null, 'Pending collection', false, false, 'Aditya Menon', 'class_rep'),
  ('aaaaaaaa-0005-0000-0000-000000000005', '33333333-3333-3333-3333-333333333301', '3CSE05', 'Eshan Tiwari', '+91 91234 56705', 2600.00, 2600.00, 'upi', 'UPI/2026/7788991', 'Verified in bank statement', false, false, 'Elena Vance', 'admin'),
  ('aaaaaaaa-0006-0000-0000-000000000006', '33333333-3333-3333-3333-333333333301', '3CSE06', 'Farhan Akhtar', '+91 91234 56706', 2600.00, 2600.00, 'cash', 'REC-Y3-11', 'Collected by Meera', true, false, 'Meera Krishnan', 'class_rep'),
  ('aaaaaaaa-0007-0000-0000-000000000007', '33333333-3333-3333-3333-333333333301', '3CSE07', 'Gayathri Natarajan', '+91 91234 56707', 2600.00, 0.00, 'cash', null, 'Requested 2 days time', false, false, 'Meera Krishnan', 'class_rep'),
  ('aaaaaaaa-0008-0000-0000-000000000008', '33333333-3333-3333-3333-333333333301', '3CSE08', 'Harish Chander', '+91 91234 56708', 2600.00, 2600.00, 'upi', 'UPI/2026/9021481', 'Received via PhonePe', false, false, 'Aditya Menon', 'class_rep')
on conflict (id) do update 
set amount_paid = excluded.amount_paid,
    payment_mode = excluded.payment_mode,
    reference_id = excluded.reference_id,
    notes = excluded.notes,
    rep_handover_verified = excluded.rep_handover_verified,
    treasurer_verified = excluded.treasurer_verified;

-- 3. INSERT SAMPLE STUDENTS FOR YEAR 1 - CSE A
insert into public.students (id, class_id, roll_number, name, phone, amount_due, amount_paid, payment_mode, reference_id, notes, rep_handover_verified, treasurer_verified, updated_by_name, updated_by_role)
values
  ('bbbbbbbb-0001-0000-0000-000000000001', '11111111-1111-1111-1111-111111111101', '1CSE01', 'Ayaan Khan', '+91 92345 67801', 2600.00, 2600.00, 'upi', 'UPI/2026/1122334', 'Verified', false, false, 'Aarav Sharma', 'class_rep'),
  ('bbbbbbbb-0002-0000-0000-000000000002', '11111111-1111-1111-1111-111111111101', '1CSE02', 'Bhavika Jha', '+91 92345 67802', 2600.00, 2600.00, 'cash', 'REC-Y1-01', 'Paid in cash', true, true, 'Elena Vance', 'admin'),
  ('bbbbbbbb-0003-0000-0000-000000000003', '11111111-1111-1111-1111-111111111101', '1CSE03', 'Chetan Roy', '+91 92345 67803', 2600.00, 0.00, 'cash', null, 'Unpaid', false, false, 'Diya Patel', 'class_rep'),
  ('bbbbbbbb-0004-0000-0000-000000000004', '11111111-1111-1111-1111-111111111101', '1CSE04', 'Dhruv Malhotra', '+91 92345 67804', 2600.00, 2600.00, 'upi', 'UPI/2026/4455667', 'Paid online', false, false, 'Aarav Sharma', 'class_rep')
on conflict (id) do update 
set amount_paid = excluded.amount_paid,
    payment_mode = excluded.payment_mode,
    reference_id = excluded.reference_id,
    notes = excluded.notes,
    rep_handover_verified = excluded.rep_handover_verified,
    treasurer_verified = excluded.treasurer_verified;

-- 4. INSERT SAMPLE BILLS FOR FACILITATION COMMITTEE
insert into public.bills (id, title, description, vendor_name, category, amount, bill_date, receipt_url, status, submitted_by, submitted_by_name)
values
  ('cccccccc-0001-0000-0000-000000000001', 'Stage Lighting & Truss Rigging', 'Main auditorium stage moving heads and wash lights for 2 days event', 'Sunlight Audio-Visuals Kochi', 'sound_and_lights', 18500.00, current_date - 3, 'https://images.unsplash.com/photo-1516450360452-9312f5e86fc7?w=600', 'approved', null, 'Ananya Roy (Facilitation)'),
  ('cccccccc-0002-0000-0000-000000000002', 'Stage Floral & Backdrop Decoration', 'Welcome arch, floral bouquets for dignitaries and flex backdrop', 'Green Leaf Decorators', 'decorations', 9200.00, current_date - 2, 'https://images.unsplash.com/photo-1464366400600-7168b8af9bc3?w=600', 'approved', null, 'Ananya Roy (Facilitation)'),
  ('cccccccc-0003-0000-0000-000000000003', 'Guest Mementos & Event Trophies', 'Custom engraved acrylic mementos (25 pcs) and winner shields', 'Champion Crafts & Trophies', 'prizes_mementos', 6400.00, current_date - 1, 'https://images.unsplash.com/photo-1578269174936-2709b6aeb913?w=600', 'pending', null, 'Ananya Roy (Facilitation)'),
  ('cccccccc-0004-0000-0000-000000000004', 'Dignitary & Volunteer Refreshments', 'High-tea snacks and mineral water crates for faculty and volunteer team', 'Campus Canteen Catering', 'refreshments_food', 4850.00, current_date, 'https://images.unsplash.com/photo-1555244162-803834f70033?w=600', 'pending', null, 'Ananya Roy (Facilitation)')
on conflict (id) do update
set amount = excluded.amount,
    status = excluded.status,
    submitted_by_name = excluded.submitted_by_name;
