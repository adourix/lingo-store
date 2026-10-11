-- Future tables are append-only by default for the runtime role.
-- Mutable tables/columns must receive explicit UPDATE grants in reviewed migrations.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'lingo_app')
     AND EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'lingo_migrator') THEN
    ALTER DEFAULT PRIVILEGES FOR ROLE lingo_migrator IN SCHEMA public
      REVOKE UPDATE ON TABLES FROM lingo_app;
    ALTER DEFAULT PRIVILEGES FOR ROLE lingo_migrator IN SCHEMA public
      REVOKE DELETE ON TABLES FROM lingo_app;
  END IF;
END $$;
