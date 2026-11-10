
"use client";

import { useMemo, useState } from "react";
import { parseSailsIDL, type ParsedIDL } from "../lib/sails-idl-parser";

const tabs = [
  ["services", "Services"],
  ["functions", "Functions"],
  ["constructors", "Constructors"],
  ["types", "Types"],
  ["events", "Events"],
  ["programs", "Programs"],
] as const;

type TabID = (typeof tabs)[number][0];

function safeEntries(
  parsed: ParsedIDL | null,
  key: TabID,
) {
  const value = parsed?.[key];
  return Array.isArray(value) ? value : [];
}

export default function IDLExplorer() {
  const [input, setInput] = useState("");
  const [fileName, setFileName] = useState("");
  const [error, setError] = useState("");
  const [parsed, setParsed] = useState<ParsedIDL | null>(null);
  const [selected, setSelected] = useState<TabID>("services");

  const entries = useMemo(
    () => safeEntries(parsed, selected),
    [parsed, selected],
  );

  function inspectIDL() {
    setError("");
    setParsed(null);

    if (!input.trim()) {
      setError("Paste a Sails .idl file or upload one first.");
      return;
    }

    try {
      const result = parseSailsIDL(input);

      // Normalize parser output so missing fields cannot crash the UI.
      const normalized: ParsedIDL = {
        version: result.version ?? "Unknown",
        warnings: Array.isArray(result.warnings) ? result.warnings : [],
        services: Array.isArray(result.services) ? result.services : [],
        functions: Array.isArray(result.functions) ? result.functions : [],
        constructors: Array.isArray(result.constructors) ? result.constructors : [],
        types: Array.isArray(result.types) ? result.types : [],
        events: Array.isArray(result.events) ? result.events : [],
        programs: Array.isArray(result.programs) ? result.programs : [],
        serviceIds: Array.isArray(result.serviceIds) ? result.serviceIds : [],
      };

      setParsed(normalized);
      setSelected("services");
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Unable to parse this Sails IDL file.",
      );
    }
  }

  async function uploadFile(file?: File) {
    if (!file) return;

    setFileName(file.name);
    setError("");
    setParsed(null);

    try {
      const content = await file.text();
      setInput(content);
    } catch {
      setError("Could not read this file.");
    }
  }

  function clearInput() {
    setInput("");
    setFileName("");
    setError("");
    setParsed(null);
    setSelected("services");
  }

  function downloadReport() {
    if (!parsed) return;

    const report = {
      file: fileName || "pasted-idl",
      generatedAt: new Date().toISOString(),
      ...parsed,
    };

    const blob = new Blob(
      [JSON.stringify(report, null, 2)],
      { type: "application/json" },
    );

    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");

    link.href = url;
    link.download = "sails-idl-report.json";
    document.body.appendChild(link);
    link.click();
    link.remove();

    URL.revokeObjectURL(url);
  }

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
          Developer tools / Interface inspection
        </p>

        <h1 className="mt-3 text-4xl font-bold tracking-tight">
          IDL Explorer
        </h1>

        <p className="mt-4 max-w-2xl leading-7 text-[#a1aab7]">
          Inspect Sails IDL v2 files, including services, functions,
          constructors, custom types, events and programs. Processing happens
          locally in your browser.
        </p>

        <div className="mt-9 grid gap-6 lg:grid-cols-2">
          {/* Input panel */}
          <section className="rounded-xl border border-[#29313b] bg-[#12161c] p-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h2 className="font-semibold">Sails IDL input</h2>

              <label className="cursor-pointer rounded-lg border border-[#29313b] px-3 py-2 text-sm hover:border-[#a8f56a]">
                Upload .idl

                <input
                  type="file"
                  accept=".idl,.txt"
                  className="hidden"
                  onChange={(event) => {
                    uploadFile(event.target.files?.[0]);
                    event.currentTarget.value = "";
                  }}
                />
              </label>
            </div>

            {fileName && (
              <p className="mt-3 text-xs text-[#a1aab7]">
                Selected: {fileName}
              </p>
            )}

            <textarea
              value={input}
              onChange={(event) => {
                setInput(event.target.value);
                setParsed(null);
                setError("");
              }}
              spellCheck={false}
              placeholder={"Paste your Sails IDL here...\n\n!@sails: 2.0.0"}
              className="mt-4 min-h-[390px] w-full resize-y rounded-lg border border-[#29313b] bg-[#080a0c] p-4 font-mono text-sm leading-6 text-[#a8f56a] outline-none focus:border-[#a8f56a]"
            />

            {error && (
              <p
                role="alert"
                className="mt-3 rounded-lg border border-red-900 bg-red-950/40 p-3 text-sm text-red-300"
              >
                {error}
              </p>
            )}

            <div className="mt-4 flex flex-wrap gap-3">
              <button
                onClick={inspectIDL}
                className="rounded-lg bg-[#a8f56a] px-5 py-3 text-sm font-semibold text-[#10150c] hover:bg-[#bcff8b]"
              >
                Inspect Sails IDL →
              </button>

              <button
                onClick={clearInput}
                className="rounded-lg border border-[#29313b] px-5 py-3 text-sm hover:border-[#a8f56a]"
              >
                Clear
              </button>
            </div>
          </section>

          {/* Results panel */}
          <section className="rounded-xl border border-[#29313b] bg-[#12161c] p-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h2 className="font-semibold">Inspection results</h2>

              {parsed && (
                <button
                  onClick={downloadReport}
                  className="text-sm text-[#a8f56a] hover:underline"
                >
                  Export JSON ↓
                </button>
              )}
            </div>

            {!parsed ? (
              <div className="mt-4 flex min-h-[450px] items-center justify-center rounded-lg border border-dashed border-[#29313b] p-8 text-center">
                <div>
                  <div className="text-3xl text-[#a8f56a]">⌘</div>

                  <p className="mt-4 font-medium">
                    Ready to inspect
                  </p>

                  <p className="mt-2 text-sm text-[#a1aab7]">
                    Upload your actual .idl file or paste its contents.
                  </p>
                </div>
              </div>
            ) : (
              <>
                {/* Version */}
                <div className="mt-5 rounded-lg border border-[#29313b] bg-[#0b0d10] p-4">
                  <p className="text-xs text-[#a1aab7]">
                    Sails version
                  </p>

                  <p className="mt-1 font-semibold text-[#a8f56a]">
                    Sails {parsed.version}
                  </p>

                  {parsed.serviceIds.map((id, index) => (
                    <p
                      key={`${id}-${index}`}
                      className="mt-2 break-all font-mono text-xs text-[#a1aab7]"
                    >
                      Service ID: {id}
                    </p>
                  ))}
                </div>

                {/* Warnings */}
                {parsed.warnings.length > 0 && (
                  <div className="mt-3 rounded-lg border border-yellow-800 bg-yellow-950/30 p-3">
                    {parsed.warnings.map((warning, index) => (
                      <p
                        key={index}
                        className="text-sm text-yellow-300"
                      >
                        ⚠ {warning}
                      </p>
                    ))}
                  </div>
                )}

                {/* Summary cards */}
                <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3">
                  {tabs.map(([id, label]) => {
                    const count = safeEntries(parsed, id).length;

                    return (
                      <button
                        key={id}
                        onClick={() => setSelected(id)}
                        className={`rounded-lg border p-3 text-left ${
                          selected === id
                            ? "border-[#a8f56a] bg-[#192316]"
                            : "border-[#29313b] bg-[#0b0d10]"
                        }`}
                      >
                        <p className="text-xs text-[#a1aab7]">
                          {label}
                        </p>

                        <p className="mt-1 text-2xl font-semibold">
                          {count}
                        </p>
                      </button>
                    );
                  })}
                </div>

                {/* Selected section */}
                <div className="mt-6">
                  <h3 className="font-semibold">
                    {tabs.find(([id]) => id === selected)?.[1]}
                  </h3>

                  <div className="mt-3 max-h-[280px] space-y-2 overflow-auto">
                    {entries.length === 0 ? (
                      <p className="rounded-lg border border-[#29313b] p-4 text-sm text-[#a1aab7]">
                        No entries detected in this section.
                      </p>
                    ) : (
                      entries.map((entry, index) => (
                        <div
                          key={`${entry.name}-${index}`}
                          className="rounded-lg border border-[#29313b] bg-[#0b0d10] p-4"
                        >
                          <p className="font-medium">
                            {entry.name}
                          </p>

                          <p className="mt-1 break-words text-sm text-[#a1aab7]">
                            {entry.detail}
                          </p>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </>
            )}
          </section>
        </div>
      </div>
    </main>
  );
}
