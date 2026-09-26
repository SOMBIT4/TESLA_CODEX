ALTER TABLE drivers
    ADD COLUMN updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

CREATE UNIQUE INDEX uq_vehicles_active_driver
    ON vehicles(driver_id)
    WHERE is_active;
