ALTER TABLE customer_appointments ADD COLUMN IF NOT EXISTS additional_hau_phau_ids uuid[] DEFAULT '{}';
