INSERT INTO users (id, name, email, password_hash, role)
VALUES
    (
        '00000000-0000-4000-8000-000000000001',
        'Jashim',
        'jashim@example.com',
        '$2b$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro0MGG4w6VqvS1hO5Q/2YdJ5m',
        'DRIVER'
    ),
    (
        '00000000-0000-4000-8000-000000000002',
        'Nusrat',
        'nusrat@example.com',
        '$2b$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro0MGG4w6VqvS1hO5Q/2YdJ5m',
        'PASSENGER'
    ),
    (
        '00000000-0000-4000-8000-000000000003',
        'Rafiq',
        'rafiq@example.com',
        '$2b$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro0MGG4w6VqvS1hO5Q/2YdJ5m',
        'PASSENGER'
    ),
    (
        '00000000-0000-4000-8000-000000000004',
        'Shirin',
        'shirin@example.com',
        '$2b$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro0MGG4w6VqvS1hO5Q/2YdJ5m',
        'PASSENGER'
    )
ON CONFLICT (id) DO UPDATE SET
    name = EXCLUDED.name,
    email = EXCLUDED.email,
    password_hash = EXCLUDED.password_hash,
    role = EXCLUDED.role,
    updated_at = NOW();
