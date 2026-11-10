-- Fictional demonstration records. Safe to run more than once.
INSERT INTO members (member_name, email, phone, join_date) VALUES
('Maya Kapoor','maya.kapoor@example.test','+91-90000-10001',CURRENT_DATE-420),
('Arjun Mehta','arjun.mehta@example.test','+91-90000-10002',CURRENT_DATE-390),
('Isha Nair','isha.nair@example.test','+91-90000-10003',CURRENT_DATE-365),
('Rohan Shah','rohan.shah@example.test','+91-90000-10004',CURRENT_DATE-340),
('Anaya Iyer','anaya.iyer@example.test','+91-90000-10005',CURRENT_DATE-320),
('Kabir Rao','kabir.rao@example.test','+91-90000-10006',CURRENT_DATE-300),
('Sara Fernandes','sara.fernandes@example.test','+91-90000-10007',CURRENT_DATE-280),
('Dev Malhotra','dev.malhotra@example.test','+91-90000-10008',CURRENT_DATE-250),
('Tara Bose','tara.bose@example.test','+91-90000-10009',CURRENT_DATE-230),
('Neil Chawla','neil.chawla@example.test','+91-90000-10010',CURRENT_DATE-200),
('Zoya Khan','zoya.khan@example.test','+91-90000-10011',CURRENT_DATE-180),
('Aditya Menon','aditya.menon@example.test','+91-90000-10012',CURRENT_DATE-160),
('Meera Joshi','meera.joshi@example.test','+91-90000-10013',CURRENT_DATE-140),
('Vihaan Sethi','vihaan.sethi@example.test','+91-90000-10014',CURRENT_DATE-120),
('Diya Kulkarni','diya.kulkarni@example.test','+91-90000-10015',CURRENT_DATE-90),
('Aarav Bhatia','aarav.bhatia@example.test','+91-90000-10016',CURRENT_DATE-60),
('Nisha Roy','nisha.roy@example.test','+91-90000-10017',CURRENT_DATE-35),
('Kunal Desai','kunal.desai@example.test','+91-90000-10018',CURRENT_DATE-12)
ON CONFLICT (email) DO NOTHING;

INSERT INTO trainers (trainer_name,email,phone,specialization) VALUES
('Aditi Verma','aditi.verma@example.test','+91-90000-20001','Strength & conditioning'),
('Samar Khanna','samar.khanna@example.test','+91-90000-20002','Functional training'),
('Leena Thomas','leena.thomas@example.test','+91-90000-20003','Yoga & mobility'),
('Ibrahim Sheikh','ibrahim.sheikh@example.test','+91-90000-20004','Boxing & endurance'),
('Rhea D''Souza','rhea.dsouza@example.test','+91-90000-20005','Personal training')
ON CONFLICT (email) DO NOTHING;

INSERT INTO membership_plans (plan_name,duration_months,price,description) VALUES
('Monthly Plan',1,1800.00,'Flexible access, billed monthly.'),
('Quarterly Plan',3,4800.00,'Three months of full gym access.'),
('Half-Yearly Plan',6,8900.00,'Six months with guided progress reviews.'),
('Yearly Plan',12,15900.00,'Best value for a full year of training.')
ON CONFLICT (plan_name) DO NOTHING;

-- Multiple subscriptions per member intentionally preserve renewal history.
INSERT INTO subscriptions (member_id,plan_id,trainer_id,start_date,end_date,status)
SELECT m.member_id,p.plan_id,t.trainer_id,
       (CURRENT_DATE - v.months_ago * INTERVAL '1 month')::DATE,
       ((CURRENT_DATE - v.months_ago * INTERVAL '1 month')::DATE + make_interval(months => p.duration_months))::DATE,
       CASE WHEN v.cancelled THEN 'CANCELLED' ELSE 'ACTIVE' END
FROM (VALUES
 ('maya.kapoor@example.test','Quarterly Plan','aditi.verma@example.test',9,FALSE),
 ('maya.kapoor@example.test','Half-Yearly Plan','aditi.verma@example.test',2,FALSE),
 ('arjun.mehta@example.test','Monthly Plan','samar.khanna@example.test',7,FALSE),
 ('arjun.mehta@example.test','Quarterly Plan','samar.khanna@example.test',1,FALSE),
 ('isha.nair@example.test','Yearly Plan','leena.thomas@example.test',5,FALSE),
 ('rohan.shah@example.test','Half-Yearly Plan','ibrahim.sheikh@example.test',10,FALSE),
 ('anaya.iyer@example.test','Quarterly Plan','rhea.dsouza@example.test',4,FALSE),
 ('kabir.rao@example.test','Monthly Plan','aditi.verma@example.test',2,FALSE),
 ('sara.fernandes@example.test','Yearly Plan','leena.thomas@example.test',13,FALSE),
 ('dev.malhotra@example.test','Half-Yearly Plan','samar.khanna@example.test',1,FALSE),
 ('tara.bose@example.test','Quarterly Plan','rhea.dsouza@example.test',2,FALSE),
 ('neil.chawla@example.test','Monthly Plan','ibrahim.sheikh@example.test',5,TRUE),
 ('zoya.khan@example.test','Yearly Plan','aditi.verma@example.test',3,FALSE),
 ('aditya.menon@example.test','Quarterly Plan','samar.khanna@example.test',6,FALSE),
 ('meera.joshi@example.test','Half-Yearly Plan','leena.thomas@example.test',7,FALSE),
 ('vihaan.sethi@example.test','Monthly Plan','rhea.dsouza@example.test',1,FALSE),
 ('diya.kulkarni@example.test','Yearly Plan','ibrahim.sheikh@example.test',8,FALSE),
 ('aarav.bhatia@example.test','Quarterly Plan','aditi.verma@example.test',1,FALSE),
 ('nisha.roy@example.test','Monthly Plan','samar.khanna@example.test',0,FALSE),
 ('kunal.desai@example.test','Half-Yearly Plan','rhea.dsouza@example.test',0,TRUE),
 ('rohan.shah@example.test','Monthly Plan','ibrahim.sheikh@example.test',3,FALSE),
 ('anaya.iyer@example.test','Monthly Plan','rhea.dsouza@example.test',0,FALSE),
 ('dev.malhotra@example.test','Quarterly Plan','samar.khanna@example.test',0,FALSE),
 ('tara.bose@example.test','Monthly Plan','rhea.dsouza@example.test',0,FALSE)
) AS v(member_email,plan_name,trainer_email,months_ago,cancelled)
JOIN members m ON m.email=v.member_email
JOIN membership_plans p ON p.plan_name=v.plan_name
LEFT JOIN trainers t ON t.email=v.trainer_email
WHERE NOT EXISTS (
  SELECT 1 FROM subscriptions s
  WHERE s.member_id=m.member_id AND s.plan_id=p.plan_id
    AND s.start_date=(CURRENT_DATE - v.months_ago * INTERVAL '1 month')::DATE
);

-- Payments are attached to each listed member's latest subscription.
INSERT INTO payments (subscription_id,amount,payment_date,payment_method,payment_status)
SELECT s.subscription_id,v.amount,NOW()-v.days_ago*INTERVAL '1 day',v.method,v.status
FROM (VALUES
 ('maya.kapoor@example.test',4800.00,2,'UPI','PAID'),('maya.kapoor@example.test',8900.00,55,'CARD','PAID'),
 ('arjun.mehta@example.test',1800.00,9,'CASH','PAID'),('arjun.mehta@example.test',4800.00,35,'UPI','PENDING'),
 ('isha.nair@example.test',15900.00,18,'CARD','PAID'),('rohan.shah@example.test',8900.00,22,'BANK_TRANSFER','PAID'),
 ('anaya.iyer@example.test',4800.00,8,'UPI','PAID'),('kabir.rao@example.test',1800.00,4,'CASH','PENDING'),
 ('sara.fernandes@example.test',15900.00,61,'CARD','PAID'),('dev.malhotra@example.test',8900.00,7,'UPI','PAID'),
 ('tara.bose@example.test',4800.00,15,'BANK_TRANSFER','PAID'),('neil.chawla@example.test',1800.00,90,'CASH','FAILED'),
 ('zoya.khan@example.test',15900.00,11,'CARD','PAID'),('aditya.menon@example.test',4800.00,40,'UPI','PAID'),
 ('meera.joshi@example.test',8900.00,70,'CARD','PENDING'),('vihaan.sethi@example.test',1800.00,3,'CASH','PAID'),
 ('diya.kulkarni@example.test',15900.00,120,'BANK_TRANSFER','PAID'),('aarav.bhatia@example.test',4800.00,5,'UPI','PAID'),
 ('nisha.roy@example.test',1800.00,1,'UPI','PENDING'),('kunal.desai@example.test',8900.00,45,'CARD','REFUNDED'),
 ('rohan.shah@example.test',1800.00,65,'CASH','PAID'),('anaya.iyer@example.test',1800.00,2,'UPI','PAID'),
 ('dev.malhotra@example.test',4800.00,1,'CARD','PAID'),('tara.bose@example.test',1800.00,12,'CASH','PAID'),
 ('maya.kapoor@example.test',1200.00,0,'UPI','PENDING'),('arjun.mehta@example.test',4800.00,2,'CARD','PAID'),
 ('isha.nair@example.test',2000.00,31,'BANK_TRANSFER','PAID'),('sara.fernandes@example.test',15900.00,180,'CARD','FAILED'),
 ('zoya.khan@example.test',15900.00,32,'UPI','PAID'),('aditya.menon@example.test',2400.00,5,'CASH','PENDING'),
 ('meera.joshi@example.test',8900.00,180,'CARD','PAID'),('vihaan.sethi@example.test',1800.00,30,'UPI','PAID'),
 ('diya.kulkarni@example.test',15900.00,230,'BANK_TRANSFER','PAID'),('aarav.bhatia@example.test',4800.00,1,'UPI','PAID'),
 ('kunal.desai@example.test',8900.00,0,'CARD','PENDING')
) AS v(member_email,amount,days_ago,method,status)
JOIN members m ON m.email=v.member_email
JOIN LATERAL (
  SELECT subscription_id FROM subscriptions x WHERE x.member_id=m.member_id
  ORDER BY x.start_date DESC,x.subscription_id DESC LIMIT 1
) s ON TRUE
WHERE NOT EXISTS (
  SELECT 1 FROM payments p WHERE p.subscription_id=s.subscription_id
    AND p.amount=v.amount AND p.payment_date::DATE=(NOW()-v.days_ago*INTERVAL '1 day')::DATE
    AND p.payment_status=v.status
);

-- Attendance history spans recent and older visits; cancelled/expired memberships are excluded.
INSERT INTO attendance (subscription_id,check_in_at,check_out_at)
SELECT s.subscription_id,NOW()-v.days_ago*INTERVAL '1 day',NOW()-v.days_ago*INTERVAL '1 day'+INTERVAL '58 minutes'
FROM (VALUES
 ('maya.kapoor@example.test',0),('maya.kapoor@example.test',1),('maya.kapoor@example.test',4),
 ('arjun.mehta@example.test',0),('arjun.mehta@example.test',3),('arjun.mehta@example.test',8),
 ('isha.nair@example.test',1),('isha.nair@example.test',2),('isha.nair@example.test',6),
 ('rohan.shah@example.test',2),('rohan.shah@example.test',9),('anaya.iyer@example.test',0),
 ('anaya.iyer@example.test',3),('kabir.rao@example.test',6),('sara.fernandes@example.test',1),
 ('sara.fernandes@example.test',5),('dev.malhotra@example.test',0),('dev.malhotra@example.test',4),
 ('tara.bose@example.test',1),('tara.bose@example.test',7),('zoya.khan@example.test',2),
 ('aditya.menon@example.test',3),('meera.joshi@example.test',6),('vihaan.sethi@example.test',0),
 ('diya.kulkarni@example.test',12),('aarav.bhatia@example.test',1),('nisha.roy@example.test',0),
 ('rohan.shah@example.test',15),('anaya.iyer@example.test',22),('dev.malhotra@example.test',31)
) AS v(member_email,days_ago)
JOIN members m ON m.email=v.member_email
JOIN LATERAL (
  SELECT subscription_id FROM subscriptions x WHERE x.member_id=m.member_id
    AND x.status='ACTIVE'
    AND (NOW()-v.days_ago*INTERVAL '1 day')::DATE BETWEEN x.start_date AND x.end_date
  ORDER BY x.start_date DESC LIMIT 1
) s ON TRUE
WHERE NOT EXISTS (
  SELECT 1 FROM attendance a WHERE a.subscription_id=s.subscription_id
    AND a.check_in_at::DATE=(NOW()-v.days_ago*INTERVAL '1 day')::DATE
);
