
"use client";

import { useEffect, useState } from "react";

type Check = {
  title: string;
  status: "PASS" | "WARN" | "FAIL";
  detail: string;
};

type Report = {
  tool?: string;
  reportType?: string;
  generatedAt?: string;
  files?: { name: string; size: number }[];
  summary?: { pass: number; warnings: number; fail: number };
  checks?: Check[];
  limitations?: string;
};

function formatDate(value?: string) {
  if (!value) return "Unknown date";

  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? "Unknown date"
    : date.toLocaleString();
}

function formatSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

export default function VerificationReportsPage() {
  const [report, setReport] = useState<Report | null>(null);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    try {
      const saved = localStorage.getItem("sails-toolkit-verification-report");

      if (saved) {
        const parsed: unknown = JSON.parse(saved);

        if (
          parsed &&
          typeof parsed === "object" &&
          "checks" in parsed &&
          Array.isArray(parsed.checks)
        ) {
          setReport(parsed as Report);
        } else {
          setError("The saved report has an unexpected format.");
        }
      }
    } catch {
      setError("The saved report could not be read.");
    }

    setReady(true);
  }, []);

  function downloadJSON() {
    if (!report) return;

    const blob = new Blob([JSON.stringify(report, null, 2)], {
      type: "application/json",
    });

    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "sails-verification-report.json";
    link.click();
    URL.revokeObjectURL(url);
  }

  function downloadMarkdown() {
    if (!report) return;

    const lines = [
      "# Sails Developer Toolkit — Verification Report",
      "",
      `Generated: ${formatDate(report.generatedAt)}`,
      "",
      "## Summary",
      "",
      `- PASS: ${report.summary?.pass ?? 0}`,
      `- WARN: ${report.summary?.warnings ?? 0}`,
      `- FAIL: ${report.summary?.fail ?? 0}`,
      "",
      "## Files inspected",
      "",
      ...(report.files?.length
        ? report.files.map(
            (file) => `- ${file.name} (${formatSize(file.size)})`,
          )
        : ["- No file details recorded."]),
      "",
      "## Checks",
      "",
      ...(report.checks ?? []).flatMap((check) => [
        `### ${check.status}: ${check.title}`,
        "",
        check.detail,
        "",
      ]),
      "## Limitations",
      "",
      report.limitations ?? "See individual check descriptions.",
      "",
    ];

    const blob = new Blob([lines.join("\n")], {
      type: "text/markdown;charset=utf-8",
    });

    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "sails-verification-report.md";
    link.click();
    URL.revokeObjectURL(url);
  }

  const checks = report?.checks ?? [];
  const pass = checks.filter((check) => check.status === "PASS").length;
  const warnings = checks.filter((check) => check.status === "WARN").length;
  const fail = checks.filter((check) => check.status === "FAIL").length;

  return (
    <main className="min-h-screen bg-[#0b0d10] text-[#f3f5f7]">
      <header className="border-b border-[#29313b]">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-5">
          <a href="/" className="font-bold tracking-tight">
            SAILS <span className="text-[#a8f56a]">/ TOOLKIT</span>
          </a>
          <a
            href="/"
            className="text-sm text-[#a1aab7] hover:text-[#a8f56a]"
          >
            ← Dashboard
          </a>
        </div>
      </header>

      <div className="mx-auto max-w-7xl px-6 py-12">
        <p className="text-xs uppercase tracking-[0.2em] text-[#a8f56a]">
          Developer tools / Reports
        </p>

        <div className="mt-3 flex flex-wrap items-start justify-between gap-5">
          <div>
            <h1 className="text-4xl font-bold tracking-tight">
              Verification Reports
            </h1>
            <p className="mt-4 max-w-2xl leading-7 text-[#a1aab7]">
              Review the latest Project Integrity Checker results and export a
              report for your records.
            </p>
          </div>

          {report && (
            <div className="flex flex-wrap gap-3">
              <button
                onClick={downloadMarkdown}
                className="rounded-lg border border-[#29313b] px-4 py-3 text-sm hover:border-[#a8f56a]"
              >
                Download Markdown
              </button>
              <button
                onClick={downloadJSON}
                className="rounded-lg bg-[#a8f56a] px-4 py-3 text-sm font-semibold text-[#10150c] hover:bg-[#bcff8b]"
              >
                Download JSON ↓
              </button>
            </div>
          )}
        </div>

        {!ready ? (
          <div className="mt-8 rounded-xl border border-[#29313b] bg-[#12161c] p-6 text-[#a1aab7]">
            Loading report…
          </div>
        ) : !report ? (
          <section className="mt-8 rounded-xl border border-[#29313b] bg-[#12161c] p-8">
            <div className="text-3xl text-[#a8f56a]">⌕</div>
            <h2 className="mt-4 text-xl font-semibold">
              No saved verification report
            </h2>
            <p className="mt-3 max-w-2xl leading-7 text-[#a1aab7]">
              {error ||
                "Run the Project Integrity Checker first. Its latest results will be saved in this browser and displayed here."}
            </p>
            <a
              href="/project-integrity"
              className="mt-6 inline-flex rounded-lg bg-[#a8f56a] px-5 py-3 text-sm font-semibold text-[#10150c] hover:bg-[#bcff8b]"
            >
              Open Project Integrity Checker →
            </a>
          </section>
        ) : (
          <>
            <section className="mt-8 rounded-xl border border-[#29313b] bg-[#12161c] p-6">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <p className="text-xs uppercase tracking-widest text-[#a8f56a]">
                    Latest saved report
                  </p>
                  <h2 className="mt-2 text-2xl font-bold">
                    Project Integrity Report
                  </h2>
                  <p className="mt-2 text-sm text-[#a1aab7]">
                    Generated {formatDate(report.generatedAt)}
                  </p>
                </div>
                <span className="rounded-full border border-[#29313b] px-3 py-2 text-xs text-[#a1aab7]">
                  Browser report
                </span>
              </div>

              <div className="mt-6 grid gap-3 sm:grid-cols-3">
                {[
                  {
                    label: "PASS",
                    value: pass,
                    color: "text-[#a8f56a]",
                  },
                  {
                    label: "WARNINGS",
                    value: warnings,
                    color: "text-amber-300",
                  },
                  {
                    label: "FAIL",
                    value: fail,
                    color: "text-red-300",
                  },
                ].map((item) => (
                  <div
                    key={item.label}
                    className="rounded-xl border border-[#29313b] bg-[#0b0d10] p-5"
                  >
                    <p className="text-xs text-[#a1aab7]">{item.label}</p>
                    <p className={`mt-2 text-3xl font-bold ${item.color}`}>
                      {item.value}
                    </p>
                  </div>
                ))}
              </div>
            </section>

            <section className="mt-8">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <h2 className="text-2xl font-bold">Individual checks</h2>
                <span className="text-sm text-[#a1aab7]">
                  {checks.length} total
                </span>
              </div>

              <div className="mt-4 space-y-3">
                {checks.map((check, index) => (
                  <article
                    key={`${check.title}-${index}`}
                    className="rounded-xl border border-[#29313b] bg-[#12161c] p-5"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <h3 className="font-semibold">{check.title}</h3>
                      <span
                        className={`rounded-full border px-3 py-1 text-xs font-semibold ${
                          check.status === "PASS"
                            ? "border-[#3c5730] text-[#a8f56a]"
                            : check.status === "WARN"
                              ? "border-amber-800 text-amber-300"
                              : "border-red-900 text-red-300"
                        }`}
                      >
                        {check.status}
                      </span>
                    </div>
                    <p className="mt-3 text-sm leading-6 text-[#a1aab7]">
                      {check.detail}
                    </p>
                  </article>
                ))}
              </div>
            </section>

            <section className="mt-8 rounded-xl border border-[#29313b] bg-[#12161c] p-6">
              <h2 className="text-xl font-semibold">Files inspected</h2>
              {report.files?.length ? (
                <div className="mt-4 space-y-2">
                  {report.files.map((file, index) => (
                    <div
                      key={`${file.name}-${index}`}
                      className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-[#29313b] bg-[#0b0d10] p-4 text-sm"
                    >
                      <span className="break-all">{file.name}</span>
                      <span className="text-[#a1aab7]">
                        {formatSize(file.size)}
                      </span>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="mt-3 text-sm text-[#a1aab7]">
                  No file list was saved with this report.
                </p>
              )}
            </section>

            <section className="mt-8 rounded-xl border border-amber-900/60 bg-[#17140e] p-6">
              <h2 className="font-semibold text-amber-200">
                Important limitations
              </h2>
              <p className="mt-3 text-sm leading-6 text-[#c5bba5]">
                {report.limitations ||
                  "These are heuristic checks, not a complete build, IDL, WASM or security verification."}
              </p>
            </section>

            <button
              onClick={() => {
                localStorage.removeItem("sails-toolkit-verification-report");
                setReport(null);
              }}
              className="mt-6 text-sm text-[#a1aab7] hover:text-red-300"
            >
              Clear saved report
            </button>
          </>
        )}
      </div>
    </main>
  );
}
