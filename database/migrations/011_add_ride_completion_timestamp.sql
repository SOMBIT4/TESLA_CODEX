ALTER TABLE ride_requests
    ADD COLUMN completed_at TIMESTAMPTZ;

UPDATE ride_requests AS r
SET completed_at = p.completed_at
FROM pool_memberships AS m
JOIN pools AS p
    ON p.id = m.pool_id
WHERE m.ride_request_id = r.id
  AND r.status = 'COMPLETED'
  AND r.completed_at IS NULL
  AND p.status = 'COMPLETED'
  AND p.completed_at IS NOT NULL;

ALTER TABLE ride_requests
    ADD CONSTRAINT ride_requests_completed_at_status_check
    CHECK ((status = 'COMPLETED') = (completed_at IS NOT NULL));
