ALTER TABLE pools
    ADD COLUMN pickup_zone VARCHAR(50) NOT NULL
        CHECK (pickup_zone IN (
            'Banani',
            'Gulshan 1',
            'Gulshan 2',
            'Mohakhali',
            'Dhanmondi',
            'Mirpur',
            'Uttara',
            'Farmgate',
            'Bashundhara'
        ));

CREATE UNIQUE INDEX uq_pools_driver_active
    ON pools(driver_id)
    WHERE status IN ('MATCHED', 'DRIVER_ARRIVED', 'STARTED');
