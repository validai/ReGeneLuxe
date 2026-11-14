"use client";

import { useEffect, useState } from "react";
import { useProfileSession } from "../app/ProfileSession.jsx";

function statusClass(status) {
  if (status === "GREEN") return "text-emerald-700";
  if (status === "YELLOW") return "text-amber-700";
  return "text-rl_danger";
}

function boolLabel(value) {
  return value ? "Yes" : "No";
}

export default function ConnectionCertificationPanel() {
  const { activeProfile } = useProfileSession();
  const [matrix, setMatrix] = useState(null);
  const [error, setError] = useState("");
  const [selected, setSelected] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/certification", { credentials: "same-origin" })
      .then(async (response) => {
        const body = await response.json().catch(() => ({}));
        if (!response.ok || body.ok === false) {
          throw new Error(body.error || "Could not load certification.");
        }
        if (!cancelled) {
          setMatrix(body.certification || null);
          setError("");
          setLoading(false);
        }
      })
      .catch((err) => {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Could not load certification.");
          setMatrix(null);
          setLoading(false);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [activeProfile?.id]);

  const purpose = String(activeProfile?.workspacePurpose || "PRODUCTION").toUpperCase();

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold text-rl_text">Connection Certification</h2>
          <p className="mt-1 text-sm text-rl_muted">
            Honest readiness for this workspace. GREEN requires verified identity, scopes, dry-run path, and a controlled real provider test.
          </p>
        </div>
        <span className="rounded border border-rl_border px-2 py-1 text-[10px] font-medium uppercase tracking-wide text-rl_muted">
          {purpose} · {activeProfile?.displayName || "Workspace"}
        </span>
      </div>

      {loading ? <p className="text-sm text-rl_muted">Loading certification…</p> : null}
      {error ? (
        <p className="rounded-lg border border-rl_danger/30 bg-rl_danger/10 px-3 py-2 text-sm text-rl_danger" role="alert">
          {error}
        </p>
      ) : null}

      {matrix ? (
        <>
          <p className={`text-sm font-medium ${statusClass(matrix.system?.status)}`}>
            System · {matrix.system?.status}
            {matrix.system?.blocker ? ` · ${matrix.system.blocker}` : ""}
          </p>
          <div className="overflow-x-auto">
            <table className="min-w-full text-left text-xs">
              <thead className="text-rl_muted">
                <tr>
                  <th className="px-2 py-2 font-medium">Provider</th>
                  <th className="px-2 py-2 font-medium">Identity</th>
                  <th className="px-2 py-2 font-medium">Connected</th>
                  <th className="px-2 py-2 font-medium">Read</th>
                  <th className="px-2 py-2 font-medium">Analytics</th>
                  <th className="px-2 py-2 font-medium">Publish capable</th>
                  <th className="px-2 py-2 font-medium">Code publish</th>
                  <th className="px-2 py-2 font-medium">Ready</th>
                  <th className="px-2 py-2 font-medium">Last Test</th>
                  <th className="px-2 py-2 font-medium">Status</th>
                </tr>
              </thead>
              <tbody>
                {(matrix.providers || []).map((row) => (
                  <tr
                    key={row.provider}
                    className="cursor-pointer border-t border-rl_border hover:bg-rl_surfaceHover/50"
                    onClick={() => setSelected(row)}
                  >
                    <td className="px-2 py-2 font-medium text-rl_text">{row.displayName}</td>
                    <td className="px-2 py-2 text-rl_muted">
                      {row.identity?.handle || row.identity?.displayName || "—"}
                    </td>
                    <td className="px-2 py-2">{boolLabel(row.connected)}</td>
                    <td className="px-2 py-2">{boolLabel(row.canRead)}</td>
                    <td className="px-2 py-2">{boolLabel(row.canAnalyze)}</td>
                    <td className="px-2 py-2">{boolLabel(row.publishCapable ?? row.canPublish)}</td>
                    <td className="px-2 py-2 text-rl_muted">{boolLabel(row.publishImplemented)}</td>
                    <td className="px-2 py-2">{boolLabel(row.readyForControlledPublish)}</td>
                    <td className="px-2 py-2 text-rl_muted">
                      {row.lastTestAt ? new Date(row.lastTestAt).toLocaleString("en-US") : "—"}
                    </td>
                    <td className={`px-2 py-2 font-semibold ${statusClass(row.status)}`}>{row.status}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {selected ? (
            <div className="rounded-lg border border-rl_border px-3 py-3 text-sm">
              <p className="font-medium text-rl_text">{selected.displayName}</p>
              <p className={`mt-1 ${statusClass(selected.status)}`}>Status · {selected.status}</p>
              <p className="mt-1 text-rl_muted">
                Blocker · {selected.blocker || "None"}
              </p>
              {(selected.blockers || []).length > 1 ? (
                <ul className="mt-2 list-disc space-y-1 pl-4 text-xs text-rl_muted">
                  {selected.blockers.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
              ) : null}
              <p className="mt-2 text-xs text-rl_muted">{selected.note}</p>
            </div>
          ) : (
            <p className="text-xs text-rl_muted">Select a provider to see blockers.</p>
          )}
        </>
      ) : null}
    </div>
  );
}
