CREATE TABLE ride_status_events (
    id UUID PRIMARY KEY,
    ride_request_id UUID
        REFERENCES ride_requests(id),
    pool_id UUID
        REFERENCES pools(id),
    actor_user_id UUID
        REFERENCES users(id),
    from_status VARCHAR(30),
    to_status VARCHAR(30) NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CHECK (ride_request_id IS NOT NULL OR pool_id IS NOT NULL)
);
