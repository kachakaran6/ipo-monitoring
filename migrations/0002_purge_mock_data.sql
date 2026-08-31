-- Purge legacy fabricated IPO records and associated checks/results from old seed
DELETE FROM allotment_results WHERE ipo_id IN (SELECT id FROM ipo_master WHERE symbol IN ('TECHCORP', 'NEXUSFIN', 'GREENENRG', 'BIOHEALTH'));
DELETE FROM allotment_checks WHERE ipo_id IN (SELECT id FROM ipo_master WHERE symbol IN ('TECHCORP', 'NEXUSFIN', 'GREENENRG', 'BIOHEALTH'));
DELETE FROM ipo_applications WHERE ipo_id IN (SELECT id FROM ipo_master WHERE symbol IN ('TECHCORP', 'NEXUSFIN', 'GREENENRG', 'BIOHEALTH'));
DELETE FROM ipo_subscription_snapshots WHERE ipo_id IN (SELECT id FROM ipo_master WHERE symbol IN ('TECHCORP', 'NEXUSFIN', 'GREENENRG', 'BIOHEALTH'));
DELETE FROM ipo_master WHERE symbol IN ('TECHCORP', 'NEXUSFIN', 'GREENENRG', 'BIOHEALTH');
