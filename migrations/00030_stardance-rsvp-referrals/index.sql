ALTER TABLE stardance_referrals
  DROP CONSTRAINT IF EXISTS stardance_referrals_verification_status_check;

ALTER TABLE stardance_referrals
  ADD CONSTRAINT stardance_referrals_verification_status_check
    CHECK (verification_status IN ('rsvp', 'unverified', 'pending', 'verified', 'rejected'));
