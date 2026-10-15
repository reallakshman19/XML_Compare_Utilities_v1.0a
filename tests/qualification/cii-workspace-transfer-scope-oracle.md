# CII transfer-scope independent oracle

Status: `PASS_INDEPENDENT_REPRODUCTION`

The local runtime independently reproduced the transfer-scope state machine (without importing production modules) for:

- APPLY P1 + EXCLUDE blocked SIF -> selected mutation set contains P1 only;
- all EXCLUDE -> `TRANSFER_SCOPE_NO_APPLY_OPERATIONS`;
- candidate operation added after binding -> `TRANSFER_SCOPE_OPERATION_SET_MISMATCH`;
- TARGET hash changed -> `TRANSFER_SCOPE_TARGET_HASH_MISMATCH`.

This is independent numerical/state reproduction, not implementation-coupled execution. The authored repository JavaScript tests remain `NOT_RUN_ENVIRONMENT` until a complete checkout can execute.
