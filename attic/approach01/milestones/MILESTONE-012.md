# Milestone 12: Refinery + LLM Assist

## Goal
Build the refinery UI within the Capture frontend for promoting drafts into refined cards. Optionally use an LLM to suggest title, description, and image.

## Prerequisites
- Milestone 11 complete (Capture frontend working with draft creation)
- Milestone 9 complete (issue versions working)

## Deliverables

### 1. Refinery List Page

**`/refine`** (`src/routes/refine/+page.svelte`)
- Lists all issues with `type = draft`
- Sortable by: created_at (default), citation count, severity
- Each row shows: title, body excerpt, citation count, created_by, age
- Click to open /refine/:id
- Filter: show only my drafts vs all drafts
- Pagination

### 2. Refine Page

**`/refine/[id]`** (`src/routes/refine/[id]/+page.svelte`)

Two-column layout on desktop, stacked on mobile:

**Left column — Original draft:**
- Full markdown body rendered
- Citations list grouped by type (videos, articles, news, locations)
- Metadata from citations displayed inline
- Regions shown if any

**Right column — Refinement form:**
- Title input (pre-filled with draft title or LLM suggestion)
- Short description textarea (1-3 sentences, for card display)
- Type selector: problem / cause / action (required to promote)
- Severity selector
- Tags multi-select (from ontology, searchable dropdown)
- Image upload area (drag-drop or file picker)
- Relations section: add relations to existing issues (search + select)
- "Suggest with LLM" button (if enabled)
- "Save as Refined" button → PATCH issue to update fields + change type from draft

### 3. LLM Suggestion Endpoint

**POST /api/issues/:id/suggest** (auth required)
```json
{ "model": "optional-model-override" }
```

Backend logic:
1. Load issue body + citations metadata
2. Construct prompt:
   ```
   Given this captured information about a planetary issue, suggest:
   1. A concise title (max 80 chars)
   2. A short description (1-3 sentences) suitable for a card display
   3. The most likely type: problem, cause, or action
   
   Captured text:
   {body}
   
   Citations:
   {citation titles and summaries}
   
   Respond in JSON: {"title": "...", "description": "...", "type": "..."}
   ```
3. Call configured LLM API (env var `LLM_API_URL`, `LLM_API_KEY`)
4. Parse response, validate fields
5. Return suggestions (do NOT auto-apply — user reviews)

If LLM is not configured (env vars missing), return `{ available: false }`. Frontend hides the button.

**LLM client (`/api/llm/client.ts`):**
- Use Deno's fetch to call OpenAI-compatible API
- Support any OpenAI-compatible endpoint (local ollama, openrouter, etc.)
- Streaming not needed — single completion request
- Timeout: 30s
- Max tokens: 500
- Temperature: 0.3 (we want focused suggestions, not creative writing)

### 4. Promotion Logic

When user clicks "Save as Refined":
1. PATCH /api/issues/:id with new title, body (short description appended or replaces), type, severity
2. Attach selected tags via POST /api/issues/:id/tags
3. If image uploaded, handle via milestone 8 endpoint
4. If relations added, create via POST /api/issues/:id/relations
5. Auto-creates version snapshot (milestone 9)
6. Redirect to /i/:id/edit or /capture/recent

### 5. Manual Refinement (No LLM)

The refine page works fully without LLM. The "Suggest with LLM" button is optional enhancement. All fields can be filled manually.

## Verification
```bash
# Create a draft with links via /capture
# Navigate to /refine
# See draft in list
# Click to open /refine/:id
# Fill in fields manually, save → verify issue type changed from draft
# Create another draft, try LLM suggestion (if configured)
# Verify suggestion appears but isn't applied until confirmed
```

## Constraints
- LLM calls are optional. System works fully without LLM configured.
- Never auto-apply LLM suggestions. Always require user confirmation.
- LLM prompt includes only the issue body and citation metadata. Never send user data.
- Memory-conscious: don't load all drafts at once in refinery list. Paginate.
- Image upload reuses milestone 8 endpoint. Don't duplicate logic.
- Keep the refine page simple. No drag-and-drop kanban boards. Form + buttons.
