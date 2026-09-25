# Database Bootstrap Boundary

The PostgreSQL service is present in the initial Docker Compose topology, but database schema and seed behavior are intentionally deferred to `feature/database-schema`.

The planned migration order is:

1. `001_create_users.sql`
2. `002_create_drivers.sql`
3. `003_create_vehicles.sql`
4. `004_create_ride_requests.sql`
5. `005_create_pools.sql`
6. `006_create_pool_memberships.sql`
7. `007_create_ride_status_events.sql`
8. `008_add_indexes.sql`

The future database feature will add a migration tracking table, a Node.js migration runner, deterministic seeds for Jashim, Bullet, Nusrat, Rafiq, and Shirin, and an isolated test database workflow.
