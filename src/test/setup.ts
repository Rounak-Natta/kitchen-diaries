import "fake-indexeddb/auto";

process.env.JWT_SECRET ??=
  "kitchen-diaries-unit-test-secret-2026-minimum-32-characters";

process.env.DATABASE_URL ??=
  "postgresql://test:test@127.0.0.1:5432/kitchen_diaries_unit_test";

process.env.DIRECT_URL ??=
  process.env.DATABASE_URL;