CREATE INDEX idx_ride_requests_passenger
    ON ride_requests(passenger_id);

CREATE INDEX idx_ride_requests_status
    ON ride_requests(status);

CREATE INDEX idx_ride_requests_pickup_destination
    ON ride_requests(pickup_zone, destination_zone);

CREATE INDEX idx_pools_driver_status
    ON pools(driver_id, status);

CREATE INDEX idx_pool_memberships_pool
    ON pool_memberships(pool_id);

CREATE INDEX idx_status_events_ride
    ON ride_status_events(ride_request_id, created_at);
