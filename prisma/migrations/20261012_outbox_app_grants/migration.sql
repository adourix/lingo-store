-- The API worker uses the application DML role for transactional email jobs.
-- Keep these grants in migrations so fresh deployments match production privileges.
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE "WebOrderEmailOutbox" TO lingo_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE "ContactMessageEmailOutbox" TO lingo_app;
