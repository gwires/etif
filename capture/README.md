# Capture Frontend

SvelteKit app for quick issue drafting and viewing recent captures.

## Dev Server

```bash
scripts/capture-dev.sh
```

Opens at <http://localhost:5173>.

## Build

```bash
scripts/run.sh bash -c 'cd capture && pnpm build'
```

Output in `capture/build/`. Preview with:

```bash
scripts/run.sh bash -c 'cd capture && pnpm preview'
```

## Type Check

```bash
scripts/run.sh bash -c 'cd capture && pnpm check'
```
