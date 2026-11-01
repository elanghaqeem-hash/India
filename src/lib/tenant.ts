// Technical D1 tenant key. This is a storage identifier, not a brand label: every tenant-scoped row written since
// migration 0001 carries it and immutability triggers forbid rewriting it, so the value stays stable while all
// user-facing identity (RTI) comes from the Parameter Center (company.*).
export { TENANT as TENANT_KEY } from './sales-workflow';
