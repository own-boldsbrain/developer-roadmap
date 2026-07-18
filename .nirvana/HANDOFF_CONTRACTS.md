# Handoff Contracts

## A09 -> A14
- **Event**: Skill Extracted
- **Payload**: `{ "candidateSkillId": "hash", "baselineDelta": +X% }`
- **Lock Action**: A14 acquires lock on `SKILL_OPTIMIZING` state.

## A14 -> A04/A99
- **Event**: Optimization Complete
- **Payload**: `{ "proposedSkillId": "hash", "benchmarkReport": "url" }`
- **Lock Action**: A99 acquires read-only lock for execution of Gates G0-G8.

## A99 -> A12
- **Event**: Gates Passed
- **Payload**: `{ "skillId": "hash", "signature": "verified" }`
- **Lock Action**: A12 publishes payload to Marketplace and internal distribution.
