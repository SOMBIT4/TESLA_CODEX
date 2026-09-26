CREATE TABLE ride_requests (
    id UUID PRIMARY KEY,
    passenger_id UUID NOT NULL
        REFERENCES users(id),
    pickup_zone VARCHAR(50) NOT NULL
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
        )),
    destination_zone VARCHAR(50) NOT NULL
        CHECK (destination_zone IN (
            'Banani',
            'Gulshan 1',
            'Gulshan 2',
            'Mohakhali',
            'Dhanmondi',
            'Mirpur',
            'Uttara',
            'Farmgate',
            'Bashundhara'
        )),
    seats_requested SMALLINT NOT NULL CHECK (seats_requested > 0),
    status VARCHAR(30) NOT NULL
        CHECK (status IN (
            'REQUESTED',
            'MATCHED',
            'DRIVER_ARRIVED',
            'STARTED',
            'COMPLETED',
            'CANCELLED'
        )),
    estimated_fare_poysha INTEGER NOT NULL
        CHECK (estimated_fare_poysha >= 0),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    cancelled_at TIMESTAMPTZ
);
