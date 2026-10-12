-- The API uses the lingo_app role for runtime DML.
-- Category deletion is an administrative mutation and requires DELETE on Category.
GRANT DELETE ON TABLE "Category" TO lingo_app;
