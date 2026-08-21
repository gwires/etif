Speak succinctly, skip conversational filler, and output only code
diffs rather than rewriting whole files.

Never commit unless I explicitly told you.

Never go straight into code modifications, write out a conceptual
plan first and ask me to approve it before you execute.

Minimalism is paramount:
- Write the least code possible. Every line must justify its existence.
- No CSS frameworks, no component libraries, no bundler bloat.
- Prefer platform-native HTML/CSS/JS over abstractions.
- Inline styles or a single small stylesheet. No preprocessors.
- No icons libraries — use unicode, text, or hand-drawn SVG if needed.
- Avoid dependencies unless they solve a hard problem (s2, pg driver).
- Smaller is faster. Fewer deps = fewer bugs = easier maintenance.
- When in doubt between two approaches, pick the one with less code.
- Deno std > third-party packages where feasible.
- Server-rendered HTML preferred over client-side hydration.
- This machine is memory-constrained: no parallel builds, no heavy watchers.

