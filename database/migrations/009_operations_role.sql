-- Adds the RFD Paralegal / Operations demonstration account.
INSERT INTO org_memberships (id, organization_id, user_uid, email, role)
VALUES (UUID(), '11111111-1111-4111-8111-111111111111', 'user-operations', 'operations@ojix.local', 'operations')
ON DUPLICATE KEY UPDATE email=VALUES(email), role=VALUES(role);
