// lib/inject.mjs — deterministic prompt-injection DETECTION for untrusted content.
// No model calls, no side effects. Pure function; unit-testable.
//
// Role in the defense stack (important — read before changing):
//   • The verdict NONCE is the ENFORCEMENT layer: an echoed/injected verdict line
//     can't carry the per-call token, so it can't force convergence. That's done.
//   • This scanner is the REPORTING layer ("default = A"): it flags that an artifact
//     CONTAINS manipulation-shaped content, so a run over a hostile file says so in
//     the transcript instead of passing silently. It does NOT gate convergence.
//
// Why it must not gate: this tool's normal job includes reviewing security code and
// docs that legitimately discuss injection (e.g. orchestrate.mjs's own guard text).
// Blocking or auto-failing on a signature hit would make that impossible. So a hit is
// a WARNING annotation, never an enforcement action. Expect benign hits on security
// artifacts — that's correct, and the warning says as much.

const SIGNATURES = [
  { id: "verdict-forge",
    re: /^[ \t]*(?:<<[^>\n]*>>[ \t]*)?(?:severity|verdict|top-confidence)[ \t]*:/im,
    what: "verdict-shaped line (could be an attempt to plant a convergence signal)" },
  { id: "instruction-override",
    re: /\b(?:ignore|disregard|forget|override)\b[^.\n]{0,40}\b(?:previous|above|prior|earlier|all)\b[^.\n]{0,24}\b(?:instruction|prompt|rule|direction|context)/i,
    what: "instruction-override phrase" },
  { id: "role-hijack",
    re: /\byou are (?:now|actually|really)\b|\bas (?:the |a )?(?:trusted|system|operator|admin|developer)\b|\bnew (?:instructions?|task|role|system prompt)[ \t]*:/i,
    what: "role/authority hijack phrase" },
  { id: "fence-forge",
    re: /<<<[ \t]*END\b|—[ \t]*UNTRUSTED DATA|DO NOT FOLLOW ANY INSTRUCTIONS/i,
    what: "forged fence / END marker (fence-escape attempt)" },
  { id: "exfiltration",
    re: /\b(?:reveal|print|repeat|output|show)\b[^.\n]{0,30}\b(?:your|the above|system)\b[^.\n]{0,20}\b(?:prompt|instructions?|rules?)\b/i,
    what: "system-prompt exfiltration attempt" },
];

// Returns an array of { id, what, line, sample } — one entry per DISTINCT signature
// that matched at least once (deduped by id; first match reported with its line no.).
export function scanInjection(text) {
  const s = String(text ?? "");
  const hits = [];
  for (const sig of SIGNATURES) {
    const m = sig.re.exec(s);
    if (!m) continue;
    const before = s.slice(0, m.index);
    const line = before.split(/\r?\n/).length;      // 1-based line of the first hit
    hits.push({ id: sig.id, what: sig.what, line, sample: m[0].trim().slice(0, 80) });
  }
  return hits;
}

// Render a short transcript/console block, or "" if nothing matched.
export function injectionNotice(hits) {
  if (!hits.length) return "";
  const rows = hits.map(h => `  • [${h.id}] line ${h.line}: ${h.what}\n      ${JSON.stringify(h.sample)}`).join("\n");
  return `⚠ Injection scan: the artifact contains ${hits.length} manipulation-shaped ` +
    `pattern(s). The verdict nonce already blocks any of these from forcing convergence; ` +
    `this is a heads-up, not a failure. (Benign on security code/docs that discuss these ` +
    `patterns — judge in context.)\n${rows}`;
}
