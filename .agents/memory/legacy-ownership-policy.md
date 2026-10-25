---
name: Legacy ownership policy
description: Why unknown owners stay unassigned and which existing relationships can authorize legacy evidence.
---

Do not infer legacy owners from the current user, activity, or the first login.
Keep unknown records unassigned and fail closed until ownership is reviewed.

**Why:** The user explicitly requires preservation without guessed or silent
assignments. Historical ownership metadata is incomplete; a bulk backfill could
permanently expose another person's data.

**How to apply:** A real parent-child relationship can authorize evidence via
its owned parent without assigning an owner. An explicit owner must also agree
with that parent. Standalone unknown records remain inaccessible. Do not let
cascades silently resolve inconsistent relationships or expose them through
SET NULL. Any administrative reassignment needs a separate, reviewed mapping.
