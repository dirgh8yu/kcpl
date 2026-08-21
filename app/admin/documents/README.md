# KCPL Document Vault v2

The live shipment Document Vault treats uploaded files as **Received** until a permitted reviewer verifies them.

- Only verified, unexpired shipment documents satisfy controlled shipment readiness.
- Deleted documents are tombstoned so audit metadata remains available even after private Storage cleanup.
- Replacements may supersede older versions without erasing history.
- The global workspace is available at `/admin/documents` and remains subject to shipment branch access.

This directory is intentionally separate from Migration Hub's historical Paper Archive. The Paper Archive preserves source evidence; Document Vault controls live operational shipment documents.
