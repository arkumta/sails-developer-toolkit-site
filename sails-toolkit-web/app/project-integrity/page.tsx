"use client";

import Link from "next/link";
import { useState } from "react";

type Status = "PASS" | "WARN" | "FAIL";

type CheckResult = {
  title: string;
  status: Status;
  detail: string;
};

type ProjectFile = {
  name: string;
  size: number;
  content: string;
};

type CargoResult = {
  command: string;
  status: Status;
  exitCode: number | null;
  durationMs: number;
  stdout: string;
  stderr: string;
  timedOut: boolean;
  generatedAt: string;
};

type RunnerStatus = {
  connected: boolean;
  project: string;
};

const RUNNER_URL = "http://127.0.0.1:43127";
const REPORT_KEY = "sails-toolkit-verification-report";

function basename(path: string) {
  return path.split("/").pop()?.toLowerCase() ?? path.toLowerCase();
}

function formatSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

function statusStyle(status: Status) {
  if (status === "PASS") return "border-[#3c5730] text-[#a8f56a]";
  if (status === "WARN") return "border-amber-800 text-amber-300";
  return "border-red-900 text-red-300";
}

function createChecks(files: ProjectFile[]): CheckResult[] {
  const results: CheckResult[] = [];

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
        (file.content.match(
          /^\s*[A-Za-z_]\w*\s*\([^)]*\)\s*->\s*[^;]+;/gm,
        )?.length ?? 0),
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
    const matches = idlServiceNames.some((name) =>
      sourceNames.includes(name),
    );

    results.push({
      title: "IDL and Rust name comparison",
      status: matches ? "PASS" : "WARN",
      detail: matches
        ? "At least one service name matches a struct, trait or impl name in the selected Rust files."
        : "No exact service-name match was found. This is only a basic name comparison, not a proof of inconsistency.",
    });
  }

  if (!cargo && rustFiles.length === 0 && idlFiles.length === 0) {
    results.push({
      title: "Project selection",
      status: "FAIL",
      detail:
        "The selected files do not include a recognizable Cargo manifest, Rust source or IDL file.",
    });
  }

  return results;
}

export default function ProjectIntegrityPage() {
  const [files, setFiles] = useState<ProjectFile[]>([]);
  const [results, setResults] = useState<CheckResult[] | null>(null);
  const [cargoResults, setCargoResults] = useState<CargoResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [runningCargo, setRunningCargo] = useState(false);
  const [error, setError] = useState("");
  const [runnerError, setRunnerError] = useState("");
  const [runnerToken, setRunnerToken] = useState("");
  const [runner, setRunner] = useState<RunnerStatus | null>(null);

  function saveReport(
    checks: CheckResult[],
    commands: CargoResult[],
    selectedFiles: ProjectFile[],
  ) {
    const allChecks: CheckResult[] = [
      ...checks,
      ...commands.map((command) => ({
        title: command.command,
        status: command.status,
        detail: `Exit code: ${command.exitCode ?? "N/A"}. Duration: ${(
          command.durationMs / 1000
        ).toFixed(2)} seconds.${command.timedOut ? " Timed out." : ""}`,
      })),
    ];

    const report = {
      tool: "Sails Developer Toolkit",
      reportType: "Project Integrity Report",
      generatedAt: new Date().toISOString(),
      files: selectedFiles.map(({ name, size }) => ({ name, size })),
      summary: {
        pass: allChecks.filter((r) => r.status === "PASS").length,
        warnings: allChecks.filter((r) => r.status === "WARN").length,
        fail: allChecks.filter((r) => r.status === "FAIL").length,
      },
      checks: allChecks,
      cargoResults: commands,
      limitations:
        "File inspection uses heuristic browser checks. Cargo commands, when present, were executed by a separate local runner against its configured project directory. Selected browser files are not automatically synchronized with that directory. Cargo check and cargo test do not constitute a security audit, WASM binary verification or complete IDL validation.",
    };

    localStorage.setItem(REPORT_KEY, JSON.stringify(report));
    return report;
  }

  async function handleFiles(selected: FileList | null) {
    if (!selected?.length) return;

    setLoading(true);
    setError("");
    setResults(null);
    setCargoResults([]);

    try {
      const loaded = await Promise.all(
        Array.from(selected).map(async (file) => {
          const name = file.webkitRelativePath || file.name;
          const lowerName = name.toLowerCase();

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
      setError("Select your project files first.");
      return;
    }

    const checks = createChecks(files);

    if (cargoResults.length === 0) {
      checks.push({
        title: "Build verification",
        status: "WARN",
        detail:
          "No local Cargo command results are attached. Connect the local runner and run cargo check and cargo test for actual build and test results.",
      });
    }

    setResults(checks);

    try {
      saveReport(checks, cargoResults, files);
    } catch {
      setError("Results were generated, but the browser could not save the report.");
    }
  }

  async function connectRunner() {
    setRunnerError("");
    setRunner(null);

    try {
      const response = await fetch(`${RUNNER_URL}/status`, {
        method: "GET",
        cache: "no-store",
      });

      if (!response.ok) {
        throw new Error(`Runner returned HTTP ${response.status}.`);
      }

      const data: RunnerStatus = await response.json();

      if (!data.connected || typeof data.project !== "string") {
        throw new Error("Unexpected runner response.");
      }

      setRunner(data);
    } catch {
      setRunnerError(
        "Could not connect to the local runner. Start it in Terminal and open this page through localhost:3000. Browser permissions may also block the connection.",
      );
    }
  }

  async function runCargoCommands() {
    if (!runner || !runnerToken.trim() || runningCargo) return;

    setRunnerError("");
    setRunningCargo(true);
    setCargoResults([]);

    const commands: CargoResult[] = [];

    try {
      for (const command of ["check", "test"] as const) {
        const response = await fetch(`${RUNNER_URL}/run`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${runnerToken.trim()}`,
          },
          body: JSON.stringify({ command }),
          cache: "no-store",
        });

        if (!response.ok) {
          let message = `HTTP ${response.status}`;

          try {
            const data = await response.json();
            if (typeof data.error === "string") message = data.error;
          } catch {
            // Keep the HTTP error.
          }

          throw new Error(message);
        }

        const data: CargoResult = await response.json();

        if (
          data.command !== `cargo ${command}` ||
          !["PASS", "WARN", "FAIL"].includes(data.status) ||
          typeof data.durationMs !== "number" ||
          typeof data.stdout !== "string" ||
          typeof data.stderr !== "string"
        ) {
          throw new Error("The runner returned an unexpected result.");
        }

        commands.push(data);
        setCargoResults([...commands]);
      }

      const checks = results ?? (files.length ? createChecks(files) : []);

      const updatedChecks = checks.filter(
        (check) => check.title !== "Build verification",
      );

      setResults(updatedChecks);

      try {
        saveReport(updatedChecks, commands, files);
      } catch {
        setRunnerError(
          "Cargo commands completed, but the browser could not save the report.",
        );
      }
    } catch (caught) {
      const message =
        caught instanceof Error ? caught.message : "Unknown runner error";

      setRunnerError(`Cargo execution stopped: ${message}`);

      const checks = (results ?? (files.length ? createChecks(files) : []))
        .filter((check) => check.title !== "Build verification");

      setResults(checks);

      try {
        saveReport(checks, commands, files);
      } catch {
        setRunnerError(
          `Cargo execution stopped: ${message}. The partial report could not be saved.`,
        );
      }
    } finally {
      setRunningCargo(false);
    }
  }

  function downloadReport() {
    if (!results) return;

    try {
      const report = saveReport(results, cargoResults, files);

      const blob = new Blob([JSON.stringify(report, null, 2)], {
        type: "application/json",
      });

      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = "sails-project-integrity-report.json";
      link.click();
      URL.revokeObjectURL(url);
    } catch {
      setError("Could not prepare the report download.");
    }
  }

  const allResults: CheckResult[] = [
    ...(results ?? []),
    ...cargoResults.map((result) => ({
      title: result.command,
      status: result.status,
      detail: `Exit code: ${result.exitCode ?? "N/A"} · ${(
        result.durationMs / 1000
      ).toFixed(2)} seconds`,
    })),
  ];

  const passCount = allResults.filter((r) => r.status === "PASS").length;
  const warningCount = allResults.filter((r) => r.status === "WARN").length;
  const failCount = allResults.filter((r) => r.status === "FAIL").length;

  return (
    <main className="min-h-screen bg-[#0b0d10] text-[#f3f5f7]">
      <header className="border-b border-[#29313b]">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-5">
          <Link href="/" className="font-bold tracking-tight">
            SAILS <span className="text-[#a8f56a]">/ TOOLKIT</span>
          </Link>
          <Link href="/" className="text-sm text-[#a1aab7] hover:text-[#a8f56a]">
            ← Dashboard
          </Link>
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
          Inspect selected Sails project files and optionally run real Cargo
          verification through a local runner. Selected files are inspected
          in your browser and are not uploaded to the website.
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
                    setCargoResults([]);
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

        <section className="mt-8 rounded-xl border border-[#29313b] bg-[#12161c] p-6">
          <p className="text-xs uppercase tracking-widest text-[#a8f56a]">
            Optional / Local verification
          </p>

          <h2 className="mt-2 text-xl font-semibold">
            2. Run real Cargo commands
          </h2>

          <p className="mt-3 text-sm leading-6 text-[#a1aab7]">
            Connect the local runner to execute cargo check and cargo test.
            These commands run against the project directory configured when
            you started the runner, not necessarily the files selected above.
            No arbitrary commands are supported.
          </p>

          <div className="mt-5 flex flex-wrap items-center gap-3">
            <button
              onClick={connectRunner}
              disabled={runningCargo}
              className="rounded-lg border border-[#415045] px-5 py-3 text-sm font-semibold hover:border-[#a8f56a] disabled:opacity-50"
            >
              Connect local runner
            </button>

            <span className="text-sm text-[#a1aab7]">
              {runner ? `Connected: ${runner.project}` : "Not connected"}
            </span>
          </div>

          {runner && (
            <div className="mt-5">
              <label
                htmlFor="runner-token"
                className="block text-sm font-medium"
              >
                Runner security token
              </label>

              <input
                id="runner-token"
                type="password"
                autoComplete="off"
                spellCheck={false}
                value={runnerToken}
                onChange={(event) => setRunnerToken(event.target.value)}
                placeholder="Paste the token from your Terminal"
                className="mt-2 w-full max-w-xl rounded-lg border border-[#29313b] bg-[#0b0d10] px-4 py-3 text-sm text-white outline-none focus:border-[#a8f56a]"
              />

              <p className="mt-2 text-xs text-[#a1aab7]">
                Keep this token private. It is not saved in the verification
                report or browser storage.
              </p>

              <button
                onClick={runCargoCommands}
                disabled={!runnerToken.trim() || runningCargo}
                className="mt-5 rounded-lg bg-[#a8f56a] px-5 py-3 text-sm font-semibold text-[#10150c] hover:bg-[#bcff8b] disabled:cursor-not-allowed disabled:opacity-50"
              >
                {runningCargo
                  ? "Running Cargo commands…"
                  : "Run cargo check + cargo test →"}
              </button>
            </div>
          )}

          {runnerError && (
            <p role="alert" className="mt-4 text-sm text-red-300">
              {runnerError}
            </p>
          )}

          {cargoResults.length > 0 && (
            <div className="mt-6 space-y-4">
              {cargoResults.map((result) => (
                <article
                  key={result.command}
                  className="rounded-lg border border-[#29313b] bg-[#0b0d10] p-5"
                >
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <h3 className="font-semibold">{result.command}</h3>
                    <span
                      className={`rounded-full border px-3 py-1 text-xs font-semibold ${statusStyle(result.status)}`}
                    >
                      {result.status}
                    </span>
                  </div>

                  <p className="mt-3 text-sm text-[#a1aab7]">
                    Exit code: {result.exitCode ?? "N/A"} · Duration:{" "}
                    {(result.durationMs / 1000).toFixed(2)} seconds
                    {result.timedOut ? " · Timed out" : ""}
                  </p>

                  <details className="mt-4">
                    <summary className="cursor-pointer text-sm text-[#a8f56a]">
                      View compiler / test output
                    </summary>

                    <pre className="mt-3 max-h-96 overflow-auto whitespace-pre-wrap break-words rounded-lg border border-[#29313b] bg-[#080a0c] p-4 text-xs leading-6 text-[#c9d1d9]">
                      {[result.stdout, result.stderr]
                        .filter(Boolean)
                        .join("\n") || "No output returned."}
                    </pre>
                  </details>
                </article>
              ))}
            </div>
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
              {allResults.map((result, index) => (
                <article
                  key={`${result.title}-${index}`}
                  className="rounded-xl border border-[#29313b] bg-[#12161c] p-5"
                >
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <h3 className="font-semibold">{result.title}</h3>
                    <span
                      className={`rounded-full border px-3 py-1 text-xs font-semibold ${statusStyle(result.status)}`}
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
              Browser file checks are heuristic. Cargo results, when
              available, reflect actual local command execution. Neither
              constitutes a security audit or guarantees contract correctness.
            </p>
          </section>
        )}
      </div>
    </main>
  );
}
