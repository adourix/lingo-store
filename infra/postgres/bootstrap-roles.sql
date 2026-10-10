-- Executed by the one-time PostgreSQL bootstrap superuser on a new volume.
-- Passwords are provisioned separately and never stored in this file.
CREATE ROLE lingo_app LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT;
CREATE ROLE lingo_migrator LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT;
CREATE ROLE lingo_readonly LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT;
GRANT USAGE, CREATE ON SCHEMA public TO lingo_migrator;
