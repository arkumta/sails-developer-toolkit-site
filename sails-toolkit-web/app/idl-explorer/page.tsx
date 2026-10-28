
"use client";

import { useMemo, useState } from "react";

type IDLEntry = {
  name: string;
  detail: string;
};

type ParsedIDL = {
  version: string;
  services: IDLEntry[];
  functions: IDLEntry[];
  constructors: IDLEntry[];
  types: IDLEntry[];
  events: IDLEntry[];
  programs: IDLEntry[];
  serviceIds: string[];
};

function parseSailsIDL(source: string): ParsedIDL {
  const result: ParsedIDL = {
    version: source.match(/!@sails:\s*([^\s]+)/)?.[1] ?? "Unknown",
    services: [],
    functions: [],
    constructors: [],
    types: [],
    events: [],
    programs: [],
    serviceIds: [],
  };

  const serviceMatches = [
    ...source.matchAll(/service\s+([A-Za-z_]\w*)(?:@(0x[0-9a-fA-F]+))?\s*\{/g),
  ];

  for (const match of serviceMatches) {
    result.services.push({
      name: match[1],
      detail: match[2] ? `Service ID: ${match[2]}` : "Service declaration",
    });
    if (match[2]) result.serviceIds.push(match[2]);
  }

  const programMatches = [
    ...source.matchAll(/program\s+([A-Za-z_]\w*)\s*\{/g),
  ];

  for (const match of programMatches) {
    result.programs.push({
      name: match[1],
      detail: "Program declaration",
    });
  }

  const functionMatches = [
    ...source.matchAll(/(?:@query\s*)?([A-Za-z_]\w*)\s*\(([^)]*)\)\s*->\s*([^;]+);/g),
  ];

  for (const match of functionMatches) {
    const name = match[1];
    if (["if", "while", "match", "service", "program"].includes(name)) continue;

    result.functions.push({
      name,
      detail: `(${match[2].trim()}) → ${match[3].trim()}${source.slice(Math.max(0, match.index! - 20), match.index!).includes("@query") ? " · Query" : ""}`,
    });
  }

  const constructorMatches = [
    ...source.matchAll(/([A-Za-z_]\w*)\s*\(([^)]*)\)\s*;/g),
  ];

  const constructorsSection = source.match(/constructors\s*\{([\s\S]*?)\}/);
  if (constructorsSection) {
    for (const match of constructorsSection[1].matchAll(/([A-Za-z_]\w*)\s*\(([^)]*)\)\s*;/g)) {
      result.constructors.push({
        name: match[1],
        detail: `(${match[2].trim()})`,
      });
    }
  }

  const typesSection = source.match(/types\s*\{([\s\S]*?)\n\s{0,8}\}/);
  if (typesSection) {
    for (const match of typesSection[1].matchAll(/(?:struct|enum|type)\s+([A-Za-z_]\w*)/g)) {
      result.types.push({
        name: match[1],
        detail: `Custom ${match[0].split(" ")[0]} declaration`,
      });
    }
  }

  const eventsSection = source.match(/events\s*\{([\s\S]*?)\n\s{0,8}\}/);
  if (eventsSection) {
    for (const match of eventsSection[1].matchAll(/^\s{8}([A-Za-z_]\w*)\s*\{/gm)) {
      result.events.push({
        name: match[1],
        detail: "Event declaration",
      });
    }
  }

  return result;
}

const tabs = [
  ["services", "Services"],
  ["functions", "Functions"],
  ["constructors", "Constructors"],
  ["types", "Types"],
  ["events", "Events"],
  ["programs", "Programs"],
] as const;

type TabID = (typeof tabs)[number][0];

export default function IDLExplorer() {
  const [input, setInput] = useState("");
  const [fileName, setFileName] = useState("");
  const [error, setError] = useState("");
  const [parsed, setParsed] = useState<ParsedIDL | null>(null);
  const [selected, setSelected] = useState<TabID>("services");

  const entries = useMemo(
    () => parsed?.[selected] ?? [],
    [parsed, selected],
  );

  function inspectIDL() {
    setError("");
    setParsed(null);

    if (!input.trim()) {
      setError("Paste a Sails .idl file or upload one first.");
      return;
    }

    if (!input.trimStart().startsWith("!@sails:")) {
      setError(
        "This does not look like a Sails IDL file. Expected a header such as !@sails: 2.0.0.",
      );
      return;
    }

    const result = parseSailsIDL(input);

    if (!result.services.length && !result.programs.length) {
      setError(
        "The file header was recognized, but no service or program declarations were detected.",
      );
      return;
    }

    setParsed(result);
    setSelected("services");
  }

  async function uploadFile(file?: File) {
    if (!file) return;
    setFileName(file.name);
    setError("");

    try {
      setInput(await file.text());
      setParsed(null);
    } catch {
      setError("Could not read this file.");
    }
  }

  function downloadReport() {
    if (!parsed) return;

    const report = {
      file: fileName || "pasted-idl",
      generatedAt: new Date().toISOString(),
      ...parsed,
    };

    const url = URL.createObjectURL(
      new Blob([JSON.stringify(report, null, 2)], {
        type: "application/json",
      }),
    );

    const link = document.createElement("a");
    link.href = url;
    link.download = "sails-idl-report.json";
    link.click();
    URL.revokeObjectURL(url);
  }

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
          Developer tools / Interface inspection
        </p>
        <h1 className="mt-3 text-4xl font-bold tracking-tight">IDL Explorer</h1>
        <p className="mt-4 max-w-2xl leading-7 text-[#a1aab7]">
          Inspect Sails IDL v2 files, including services, functions,
          constructors, custom types, events and programs. Processing happens
          locally in your browser.
        </p>

        <div className="mt-9 grid gap-6 lg:grid-cols-2">
          <section className="rounded-xl border border-[#29313b] bg-[#12161c] p-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h2 className="font-semibold">Sails IDL input</h2>
              <label className="cursor-pointer rounded-lg border border-[#29313b] px-3 py-2 text-sm hover:border-[#a8f56a]">
                Upload .idl
                <input
                  type="file"
                  accept=".idl,.txt"
                  className="hidden"
                  onChange={(event) => uploadFile(event.target.files?.[0])}
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
              onChange={(event) => setInput(event.target.value)}
              spellCheck={false}
              placeholder={"Paste your Sails IDL here...\n\n!@sails: 2.0.0"}
              className="mt-4 min-h-[390px] w-full resize-y rounded-lg border border-[#29313b] bg-[#080a0c] p-4 font-mono text-sm leading-6 text-[#a8f56a] outline-none focus:border-[#a8f56a]"
            />

            {error && (
              <p role="alert" className="mt-3 rounded-lg border border-red-900 bg-red-950/40 p-3 text-sm text-red-300">
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
                onClick={() => {
                  setInput("");
                  setFileName("");
                  setError("");
                  setParsed(null);
                }}
                className="rounded-lg border border-[#29313b] px-5 py-3 text-sm hover:border-[#a8f56a]"
              >
                Clear
              </button>
            </div>
          </section>

          <section className="rounded-xl border border-[#29313b] bg-[#12161c] p-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h2 className="font-semibold">Inspection results</h2>
              {parsed && (
                <button onClick={downloadReport} className="text-sm text-[#a8f56a] hover:underline">
                  Export JSON ↓
                </button>
              )}
            </div>

            {!parsed ? (
              <div className="mt-4 flex min-h-[450px] items-center justify-center rounded-lg border border-dashed border-[#29313b] p-8 text-center">
                <div>
                  <div className="text-3xl text-[#a8f56a]">⌘</div>
                  <p className="mt-4 font-medium">Ready to inspect</p>
                  <p className="mt-2 text-sm text-[#a1aab7]">
                    Upload your actual .idl file or paste its contents.
                  </p>
                </div>
              </div>
            ) : (
              <>
                <div className="mt-5 rounded-lg border border-[#29313b] bg-[#0b0d10] p-4">
                  <p className="text-xs text-[#a1aab7]">IDL version</p>
                  <p className="mt-1 font-semibold text-[#a8f56a]">
                    Sails {parsed.version}
                  </p>
                  {parsed.serviceIds.map((id) => (
                    <p key={id} className="mt-2 break-all font-mono text-xs text-[#a1aab7]">
                      Service ID: {id}
                    </p>
                  ))}
                </div>

                <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3">
                  {tabs.map(([id, label]) => (
                    <button
                      key={id}
                      onClick={() => setSelected(id)}
                      className={`rounded-lg border p-3 text-left ${
                        selected === id
                          ? "border-[#a8f56a] bg-[#192316]"
                          : "border-[#29313b] bg-[#0b0d10]"
                      }`}
                    >
                      <p className="text-xs text-[#a1aab7]">{label}</p>
                      <p className="mt-1 text-2xl font-semibold">
                        {parsed[id].length}
                      </p>
                    </button>
                  ))}
                </div>

                <div className="mt-6">
                  <h3 className="font-semibold">{tabs.find(([id]) => id === selected)?.[1]}</h3>
                  <div className="mt-3 max-h-[280px] space-y-2 overflow-auto">
                    {entries.length === 0 ? (
                      <p className="rounded-lg border border-[#29313b] p-4 text-sm text-[#a1aab7]">
                        No entries detected in this section.
                      </p>
                    ) : (
                      entries.map((entry, index) => (
                        <div key={`${entry.name}-${index}`} className="rounded-lg border border-[#29313b] bg-[#0b0d10] p-4">
                          <p className="font-medium">{entry.name}</p>
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

        <p className="mt-6 text-xs leading-5 text-[#7e8997]">
          This first Sails IDL parser uses text-pattern matching. Always
          cross-check its results against the source IDL; full grammar
          validation is not yet implemented.
        </p>
      </div>
    </main>
  );
}
