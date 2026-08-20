-- Shipment V1 runtime hardening marker.
-- The application creates the same tables defensively at runtime for existing deployments.
-- This migration intentionally has no destructive statements.
SELECT 1;
