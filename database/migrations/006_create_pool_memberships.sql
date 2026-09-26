CREATE TABLE pool_memberships (
    id UUID PRIMARY KEY,
    pool_id UUID NOT NULL
        REFERENCES pools(id) ON DELETE CASCADE,
    ride_request_id UUID NOT NULL UNIQUE
        REFERENCES ride_requests(id) ON DELETE CASCADE,
    seats_reserved SMALLINT NOT NULL CHECK (seats_reserved > 0),
    fare_poysha INTEGER NOT NULL CHECK (fare_poysha >= 0),
    status VARCHAR(20) NOT NULL
        CHECK (status IN ('ACTIVE', 'CANCELLED')),
    joined_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    cancelled_at TIMESTAMPTZ
);
