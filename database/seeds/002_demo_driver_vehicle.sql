INSERT INTO drivers (id, user_id, is_online)
VALUES (
    '00000000-0000-4000-8000-000000000011',
    '00000000-0000-4000-8000-000000000001',
    TRUE
)
ON CONFLICT (id) DO UPDATE SET
    user_id = EXCLUDED.user_id,
    is_online = EXCLUDED.is_online;

INSERT INTO vehicles (id, driver_id, name, capacity, is_active)
VALUES (
    '00000000-0000-4000-8000-000000000021',
    '00000000-0000-4000-8000-000000000011',
    'Bullet',
    3,
    TRUE
)
ON CONFLICT (id) DO UPDATE SET
    driver_id = EXCLUDED.driver_id,
    name = EXCLUDED.name,
    capacity = EXCLUDED.capacity,
    is_active = EXCLUDED.is_active;
