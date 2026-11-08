---
name: Publish schema review
description: Preserve database tuning when reviewing the full development-to-production schema diff.
---

Review the entire publish schema diff, not just the intended column additions.
Preserve existing production indexes unless their removal is explicitly intended
and reviewed.

**Why:** Production can contain indexes absent from the declared development
schema. Publishing can then propose dropping them alongside otherwise additive
changes, without reporting structural data loss.

**How to apply:** Compare production index definitions read-only, represent the
intended indexes in the schema, apply through the normal development flow, and
recheck the publish preview before recommending publication. Never use direct
production DDL or ownership backfills to resolve schema drift.
