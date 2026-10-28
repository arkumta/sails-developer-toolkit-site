
"use client";

import { useState } from "react";

type CheckResult = {
  title: string;
  status: "PASS" | "WARN" | "FAIL";
  detail: string;
};

type ProjectFile = {
  name: string;
  size: number;
  content: string;
};

function basename(path: string) {
  return path.split("/").pop()?.toLowerCase() ?? path.toLowerCase();
}

function formatSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

export default function ProjectIntegrityPage() {
  const [files, setFiles] = useState<ProjectFile[]>([]);
  const [results, setResults] = useState<CheckResult[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleFiles(selected: FileList | null) {
    if (!selected?.length) return;

    setLoading(true);
    setError("");
    setResults(null);

    try {
      const loaded = await Promise.all(
        Array.from(selected).map(async (file) => {
          const name = file.webkitRelativePath || file.name;
          const lowerName = name.toLowerCase();

          // Read text files only. WASM files are inspected by metadata,
          // not decoded as text.
          const isText =
            /\.(idl|rs|toml|json|md|txt|yml|yaml)$/i.test(lowerName) ||
            basename(lowerName) === "cargo.toml";

          let content = "";
          if (isText && file.size <= 2 * 1024 * 1024) {
            content = await file.text();
          }

          return {
            name,
            size: file.size,
            content,
          };
        }),
      );

      setFiles(loaded);
    } catch {
      setError("Some files could not be read. Try selecting them again.");
    } finally {
      setLoading(false);
    }
  }

  function runChecks() {
    setError("");

    if (files.length === 0) {
      setError("Select your project files or project folder first.");
      return;
    }

    const results: CheckResult[] = [];
    const names = files.map((file) => basename(file.name));
    const allText = files
      .filter((file) => file.content)
      .map((file) => file.content)
      .join("\n");

    const cargo = files.find(
      (file) => basename(file.name) === "cargo.toml",
    );

    const idlFiles = files.filter((file) => /\.idl$/i.test(file.name));
    const wasmFiles = files.filter((file) => /\.wasm$/i.test(file.name));
    const rustFiles = files.filter((file) => /\.rs$/i.test(file.name));

    const hasRustSource = rustFiles.some((file) =>
      /sails_rs|service\s*\{|program\s*\{|impl\s+\w+/i.test(file.content),
    );

    results.push({
      title: "Cargo manifest",
      status: cargo ? "PASS" : "FAIL",
      detail: cargo
        ? "Cargo.toml was included in the selected files."
        : "Cargo.toml was not found. Select the project root or include its manifest.",
    });

    results.push({
      title: "Rust source files",
      status: rustFiles.length > 0 ? "PASS" : "FAIL",
      detail: rustFiles.length
        ? `${rustFiles.length} Rust source file(s) selected.`
        : "No .rs source files were selected.",
    });

    if (rustFiles.length > 0) {
      results.push({
        title: "Sails source indicators",
        status: hasRustSource ? "PASS" : "WARN",
        detail: hasRustSource
          ? "Found a Sails-related or Rust service code indicator in the selected source."
          : "No familiar Sails or service code pattern was detected. This heuristic may miss valid projects.",
      });
    }

    results.push({
      title: "IDL artifact",
      status: idlFiles.length > 0 ? "PASS" : "WARN",
      detail: idlFiles.length
        ? `${idlFiles.length} .idl file(s) selected.`
        : "No .idl file was selected. Include the generated client IDL if available.",
    });

    if (idlFiles.length > 0) {
      const validIDL = idlFiles.filter((file) =>
        /^!@sails:\s*\S+/m.test(file.content.trimStart()),
      );
      const declaresService = idlFiles.some((file) =>
        /\bservice\s+\w+/i.test(file.content),
      );
      const declaresProgram = idlFiles.some((file) =>
        /\bprogram\s+\w+/i.test(file.content),
      );

      results.push({
        title: "IDL version header",
        status: validIDL.length === idlFiles.length ? "PASS" : "FAIL",
        detail:
          validIDL.length === idlFiles.length
            ? "Every selected IDL file starts with a recognizable Sails version header."
            : "At least one selected IDL file is missing a recognizable !@sails: header.",
      });

      results.push({
        title: "IDL declarations",
        status: declaresService || declaresProgram ? "PASS" : "WARN",
        detail:
          declaresService || declaresProgram
            ? `Found ${declaresService ? "a service declaration" : ""}${
                declaresService && declaresProgram ? " and " : ""
              }${declaresProgram ? "a program declaration" : ""}.`
            : "No familiar service or program declaration was detected.",
      });

      const functions = idlFiles.reduce(
        (total, file) =>
          total +
          (file.content.match(/^\s*[A-Za-z_]\w*\s*\([^)]*\)\s*->\s*[^;]+;/gm)
            ?.length ?? 0),
        0,
      );

      results.push({
        title: "IDL function declarations",
        status: functions > 0 ? "PASS" : "WARN",
        detail:
          functions > 0
            ? `Detected ${functions} function declaration(s) using a basic text pattern.`
            : "No function declarations matched the basic pattern. Check the IDL format manually.",
      });
    }

    results.push({
      title: "WASM artifact",
      status: wasmFiles.length > 0 ? "PASS" : "WARN",
      detail: wasmFiles.length
        ? `${wasmFiles.length} WASM file(s) selected: ${wasmFiles
            .map((file) => `${basename(file.name)} (${formatSize(file.size)})`)
            .join(", ")}. File presence only; binary validity is not verified.`
        : "No .wasm file was selected. Include a built artifact if one is available.",
    });

    if (wasmFiles.length > 0) {
      const emptyWasm = wasmFiles.filter((file) => file.size === 0);

      results.push({
        title: "WASM file size",
        status: emptyWasm.length === 0 ? "PASS" : "FAIL",
        detail:
          emptyWasm.length === 0
            ? "All selected WASM files are non-empty. This does not prove that they are valid WASM modules."
            : `${emptyWasm.length} WASM file(s) are empty.`,
      });
    }

    const idlServiceNames = idlFiles.flatMap((file) =>
      [...file.content.matchAll(/\bservice\s+([A-Za-z_]\w*)/g)].map(
        (match) => match[1],
      ),
    );

    const sourceNames = rustFiles.flatMap((file) =>
      [...file.content.matchAll(/(?:struct|trait|impl)\s+([A-Za-z_]\w*)/g)].map(
        (match) => match[1],
      ),
    );

    if (idlServiceNames.length > 0 && sourceNames.length > 0) {
      const matches = idlServiceNames.some((name) => sourceNames.includes(name));

      results.push({
        title: "IDL and Rust name comparison",
        status: matches ? "PASS" : "WARN",
        detail: matches
          ? "At least one service name matches a struct, trait or impl name in the selected Rust files."
          : "No exact service-name match was found. This is only a basic name comparison, not a proof of inconsistency.",
      });
    }

    results.push({
      title: "Build verification",
      status: "WARN",
      detail:
        "This browser checker does not run cargo check, cargo test, wasm-opt or a compiler. Run those checks in your local development environment.",
    });

    if (!cargo && rustFiles.length === 0 && idlFiles.length === 0) {
      results.push({
        title: "Project selection",
        status: "FAIL",
        detail:
          "The selected files do not include a recognizable Cargo manifest, Rust source or IDL file.",
      });
    }

    // Keep all selected file names available for the report.
    void names;
    void allText;

    setResults(results);

const verificationReport = {
  tool: "Sails Developer Toolkit",
  reportType: "Project Integrity Report",
  generatedAt: new Date().toISOString(),
  files: files.map(({ name, size }) => ({ name, size })),
  summary: {
    pass: results.filter((r) => r.status === "PASS").length,
    warnings: results.filter((r) => r.status === "WARN").length,
    fail: results.filter((r) => r.status === "FAIL").length,
  },
  checks: results,
  limitations:
    "Heuristic browser checks only. This is not a Cargo build result, complete IDL validation, WASM binary verification, or security audit.",
};

localStorage.setItem(
  "sails-toolkit-verification-report",
  JSON.stringify(verificationReport),
);
  }

  function downloadReport() {
    if (!results) return;

    const report = {
      tool: "Sails Developer Toolkit — Project Integrity Checker",
      generatedAt: new Date().toISOString(),
      files: files.map(({ name, size }) => ({ name, size })),
      summary: {
        pass: results.filter((result) => result.status === "PASS").length,
        warnings: results.filter((result) => result.status === "WARN").length,
        fail: results.filter((result) => result.status === "FAIL").length,
      },
      checks: results,
      limitations:
        "Heuristic browser checks only. This report is not a Cargo build result, a complete IDL grammar validation, a WASM binary verification or a security audit.",
    };

    const blob = new Blob([JSON.stringify(report, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "sails-project-integrity-report.json";
    link.click();
    URL.revokeObjectURL(url);
  }

  const passCount = results?.filter((result) => result.status === "PASS").length ?? 0;
  const warningCount = results?.filter((result) => result.status === "WARN").length ?? 0;
  const failCount = results?.filter((result) => result.status === "FAIL").length ?? 0;

  return (
    <main className="min-h-screen bg-[#0b0d10] text-[#f3f5f7]">
      <header className="border-b border-[#29313b]">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-5">
          <a href="/" className="font-bold tracking-tight">
            SAILS <span className="text-[#a8f56a]">/ TOOLKIT</span>
          </a>
          <a href="/" className="text-sm text-[#a1aab7] hover:text-[#a8f56a]">
            ← Dashboard
          </a>
        </div>
      </header>

      <div className="mx-auto max-w-7xl px-6 py-12">
        <p className="text-xs uppercase tracking-[0.2em] text-[#a8f56a]">
          Developer tools / Project verification
        </p>
        <h1 className="mt-3 text-4xl font-bold tracking-tight">
          Project Integrity Checker
        </h1>
        <p className="mt-4 max-w-3xl leading-7 text-[#a1aab7]">
          Select your Sails project files to check for common missing artifacts
          and recognizable declarations. Files are inspected locally in your
          browser; they are not uploaded to a server.
        </p>

        <section className="mt-9 rounded-xl border border-[#29313b] bg-[#12161c] p-6">
          <h2 className="text-lg font-semibold">1. Select project files</h2>
          <p className="mt-2 text-sm leading-6 text-[#a1aab7]">
            Select Cargo.toml, Rust source files, your .idl file and any
            available .wasm artifacts. You can select multiple files at once.
          </p>

          <label className="mt-5 inline-flex cursor-pointer items-center rounded-lg bg-[#a8f56a] px-5 py-3 text-sm font-semibold text-[#10150c] hover:bg-[#bcff8b]">
            {loading ? "Reading files…" : "Choose project files"}
            <input
              type="file"
              multiple
              className="hidden"
              onChange={(event) => handleFiles(event.target.files)}
              disabled={loading}
            />
          </label>

          {files.length > 0 && (
            <div className="mt-6">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h3 className="font-medium">
                  Selected files ({files.length})
                </h3>
                <button
                  onClick={() => {
                    setFiles([]);
                    setResults(null);
                    setError("");
                  }}
                  className="text-sm text-[#a1aab7] hover:text-[#a8f56a]"
                >
                  Clear selection
                </button>
              </div>
              <div className="mt-3 max-h-64 space-y-2 overflow-auto">
                {files.map((file, index) => (
                  <div
                    key={`${file.name}-${index}`}
                    className="flex items-center justify-between gap-4 rounded-lg border border-[#29313b] bg-[#0b0d10] px-4 py-3 text-sm"
                  >
                    <span className="break-all">{file.name}</span>
                    <span className="shrink-0 text-xs text-[#a1aab7]">
                      {formatSize(file.size)}
                    </span>
                  </div>
                ))}
              </div>

              <button
                onClick={runChecks}
                className="mt-5 rounded-lg bg-[#a8f56a] px-5 py-3 text-sm font-semibold text-[#10150c] hover:bg-[#bcff8b]"
              >
                Run integrity checks →
              </button>
            </div>
          )}

          {error && (
            <p role="alert" className="mt-4 text-sm text-red-300">
              {error}
            </p>
          )}
        </section>

        {results && (
          <section className="mt-8">
            <div className="flex flex-wrap items-end justify-between gap-4">
              <div>
                <p className="text-xs uppercase tracking-widest text-[#a8f56a]">
                  Inspection results
                </p>
                <h2 className="mt-2 text-2xl font-bold">Project report</h2>
              </div>
              <button
                onClick={downloadReport}
                className="rounded-lg border border-[#29313b] px-4 py-2 text-sm hover:border-[#a8f56a]"
              >
                Download report ↓
              </button>
            </div>

            <div className="mt-5 grid gap-3 sm:grid-cols-3">
              {[
                ["PASS", passCount, "text-[#a8f56a]"],
                ["WARNINGS", warningCount, "text-amber-300"],
                ["FAIL", failCount, "text-red-300"],
              ].map(([label, count, color]) => (
                <div
                  key={String(label)}
                  className="rounded-xl border border-[#29313b] bg-[#12161c] p-5"
                >
                  <p className="text-xs text-[#a1aab7]">{label}</p>
                  <p className={`mt-2 text-3xl font-bold ${color}`}>
                    {count}
                  </p>
                </div>
              ))}
            </div>

            <div className="mt-5 space-y-3">
              {results.map((result, index) => (
                <article
                  key={`${result.title}-${index}`}
                  className="rounded-xl border border-[#29313b] bg-[#12161c] p-5"
                >
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <h3 className="font-semibold">{result.title}</h3>
                    <span
                      className={`rounded-full border px-3 py-1 text-xs font-semibold ${
                        result.status === "PASS"
                          ? "border-[#3c5730] text-[#a8f56a]"
                          : result.status === "WARN"
                            ? "border-amber-800 text-amber-300"
                            : "border-red-900 text-red-300"
                      }`}
                    >
                      {result.status}
                    </span>
                  </div>
                  <p className="mt-2 text-sm leading-6 text-[#a1aab7]">
                    {result.detail}
                  </p>
                </article>
              ))}
            </div>

            <p className="mt-5 text-xs leading-5 text-[#7e8997]">
              These are heuristic checks. PASS means only that the stated
              check succeeded. It does not certify that the contract builds,
              that the WASM is executable, or that the project is secure.
            </p>
          </section>
        )}
      </div>
    </main>
  );
}
