CREATE TABLE vehicles (
    id UUID PRIMARY KEY,
    driver_id UUID NOT NULL
        REFERENCES drivers(id) ON DELETE CASCADE,
    name VARCHAR(100) NOT NULL,
    capacity SMALLINT NOT NULL CHECK (capacity > 0),
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
