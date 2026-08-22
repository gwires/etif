# Plan for fixes (from findings002.txt)

## Status Legend
- [ ] pending
- [~] deferred/skipped
- [x] done

---

## 1. Status names are incorrect
- [x] Update `<option>` labels in `capture/src/routes/capture/+page.svelte`
- [x] Update `<option>` labels in `capture/src/routes/i/[id]/edit/+page.svelte`
- [x] Update filter tabs in `capture/src/routes/capture/recent/+page.svelte`

Status meanings (per findings):
- `***` = totally zero effort, very drafty
- `**` = did some work, no longer very drafty, still needs work
- `` (empty string) = looks done
- `*` = on second thought, needs editing again

Typical workflow: `***` → `**` → `` → `*` → `` → `*` → ``

Changes needed:
- Add empty string as a valid status option in both forms
- Label the options to reflect actual meaning (e.g., "Draft", "In progress", "Done", "Needs revision")
- Update recent page filter tabs to include empty status and use correct labels

## 2. No spacing between images and save button
- [x] Add margin-bottom to `.img-grid` in `capture/src/app.css`

Simple CSS fix so thumbnails don't butt up against the save button.

## 3. Images issues

### 3a. Deno write permission
- [x] Add `--allow-read --allow-write` to `scripts/api-dev.sh`

### 3b. Paste feedback / image list position
- [x] Move image section below the quick-capture field in `capture/src/routes/capture/+page.svelte`
- [x] Ensure paste gives immediate visual feedback (thumbnails already update via `$state`, verify it works)

### 3c. Drop zone styling
- [x] Remove blue color from dragover state on image drop button in `capture/src/app.css`
- [x] Use neutral style (gray border/background only)
- [x] Ensure drop zone is not on same line as save button

### 3d. Uploaded images get 404
- [x] Investigate path mismatch: `api/captures/images.ts` stores full filesystem path in DB, but `handleServeImage` strips `/images/` prefix and looks in `config.imageDir`
- [x] Fix: store just the filename in DB (not full path), or adjust serve handler to handle full paths
- [x] Check `config.imageDir` value in `api/config.ts`

## 4. No way to delete a capture
- [x] Add delete button with confirmation dialog to `capture/src/routes/i/[id]/edit/+page.svelte`
- [x] Backend `handleDeleteCapture` already exists at `DELETE /api/captures/:id` — just needs frontend wiring

## 5. Avatar upload 400 — "Missing 'avatar' file field"
- [x] Change `fd.append('file', ...)` → `fd.append('avatar', ...)` in `capture/src/routes/profile/+page.svelte`

Frontend appends `'file'` but backend expects `'avatar'`. One-line fix.
