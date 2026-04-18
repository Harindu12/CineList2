# Security Spec for Watchlist

## 1. Data Invariants
- A title document MUST belong to the user defined in `{userId}`.
- `userId` must equal `request.auth.uid`.
- `title` must be a string <= 200 chars.
- `type` must be `'movie'` or `'tv'`.
- `status` must be `'watching'`, `'plan'`, or `'completed'`.
- Progress must be a number between 0 and 100.
- Arrays (like `cast`) must be bounded in size (e.g. max 10).
- Users can only read and write their own documents.

## 2. The "Dirty Dozen" Payloads
1. **Unauthenticated Write**: Missing `auth`.
2. **Cross-User Write**: `auth.uid` != `userId`.
3. **Cross-User Read**: Trying to read another user's titles.
4. **Missing Required Field**: Valid shape, missing `title`.
5. **Invalid Type Enum**: `type: 'podcast'`.
6. **Invalid Status Enum**: `status: 'dropped'`.
7. **Type Mismatch**: `progress: "50"` (string instead of number).
8. **Size Limits Exceeded**: `title` is 500kb.
9. **Array Size Exceeded**: `cast` array has 100 items.
10. **Schema Injection**: Payload has `isAdmin: true` ghost field.
11. **Immutable Field Change**: Changing `userId` on update.
12. **Timestamp Forgery**: `updatedAt` is past or future (not `request.time`).

## 3. Test Runner
Included in `firestore.rules.test.ts`.
