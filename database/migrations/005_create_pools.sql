CREATE TABLE pools (
    id UUID PRIMARY KEY,
    driver_id UUID NOT NULL
        REFERENCES drivers(id),
    vehicle_id UUID NOT NULL
        REFERENCES vehicles(id),
    status VARCHAR(30) NOT NULL
        CHECK (status IN (
            'MATCHED',
            'DRIVER_ARRIVED',
            'STARTED',
            'COMPLETED',
            'CANCELLED'
        )),
    capacity_snapshot SMALLINT NOT NULL CHECK (capacity_snapshot > 0),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    started_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ
);
