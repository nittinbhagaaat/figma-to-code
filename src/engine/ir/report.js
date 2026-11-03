/** Collects the conversion report: what converted, what was skipped, and what was approximated. */
export function createReport() {
  const r = { converted: 0, skipped: [], unsupported: [], approximations: [], assetFailures: [], notes: [] };
  const seen = new Set();
  const once = (list, entry) => { const k = JSON.stringify(entry); if (!seen.has(k)) { seen.add(k); list.push(entry); } };
  return {
    data: r,
    ok() { r.converted++; },
    skip(n, reason) { once(r.skipped, { id: n.id, name: n.name, type: n.type, reason }); },
    unsupported(n, feature) { once(r.unsupported, { id: n.id, name: n.name, type: n.type, feature }); },
    approx(n, note) { once(r.approximations, { id: n.id, name: n.name, note }); },
    assetFailure(n, note) { once(r.assetFailures, { id: n.id, name: n.name, note }); },
    note(msg) { if (!r.notes.includes(msg)) r.notes.push(msg); },
    summary() {
      return { converted: r.converted, skipped: r.skipped.length, unsupported: r.unsupported.length, approximations: r.approximations.length, assetFailures: r.assetFailures.length };
    },
  };
}
