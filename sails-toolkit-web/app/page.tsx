
"use client";

import { useState } from "react";

const tools = [
  {
    number: "01",
    name: "IDL Explorer",
    description:
      "Inspect Sails service interfaces, constructors, functions, types and events.",
    status: "Available",
    icon: "⌘",
  },
  {
    number: "02",
    name: "Project Integrity",
    description:
      "Check project files, required artifacts and basic IDL structure.",
    status: "Available",
    icon: "◈",
  },
  {
    number: "03",
    name: "Verification Reports",
    description:
      "Review validation results and export a report for your project.",
    status: "Available",
    icon: "✓",
  },
];

export default function Home() {
  const [activeTool, setActiveTool] = useState("IDL Explorer");

  return (
    <main className="min-h-screen bg-[#0b0d10] text-[#f3f5f7]">
      <header className="border-b border-[#29313b]">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-5">
          <a href="/" className="text-lg font-bold tracking-tight">
            SAILS <span className="text-[#a8f56a]">/ TOOLKIT</span>
          </a>

          <a
            href="https://github.com/arkumta/sails-developer-toolkit-2"
            target="_blank"
            rel="noreferrer"
            className="text-sm text-[#a1aab7] transition hover:text-[#a8f56a]"
          >
            GitHub ↗
          </a>
        </div>
      </header>

      <section className="mx-auto max-w-7xl px-6 pb-16 pt-20 md:pb-24 md:pt-28">
        <div className="mb-5 inline-flex rounded-full border border-[#3c5730] px-3 py-1 text-xs font-medium uppercase tracking-[0.18em] text-[#a8f56a]">
          Developer workspace · Vara Network
        </div>

        <h1 className="max-w-4xl text-4xl font-bold leading-tight tracking-tight md:text-6xl">
          Build Sails contracts.
          <br />
          <span className="text-[#a8f56a]">Ship with confidence.</span>
        </h1>

        <p className="mt-6 max-w-2xl text-base leading-7 text-[#a1aab7] md:text-lg">
          A practical workspace for Sails developers. Explore IDL interfaces,
          validate project artifacts and prepare clear verification reports.
        </p>

        <div className="mt-8 flex flex-wrap gap-3">
          <a
            href="#workspace"
            className="rounded-lg bg-[#a8f56a] px-5 py-3 text-sm font-semibold text-[#10150c] transition hover:bg-[#bcff8b]"
          >
            Open workspace →
          </a>

          <a
            href="https://github.com/arkumta/sails-developer-toolkit-2"
            target="_blank"
            rel="noreferrer"
            className="rounded-lg border border-[#29313b] bg-[#12161c] px-5 py-3 text-sm font-semibold transition hover:border-[#a8f56a]"
          >
            Explore source code
          </a>
        </div>

        <div className="mt-14 grid gap-4 sm:grid-cols-3">
          {[
            ["01", "Developer tools", "One focused workspace"],
            ["RUST", "Sails ecosystem", "Built for Rust projects"],
            ["OPEN", "Open source", "Built in public"],
          ].map(([value, title, description]) => (
            <div
              key={title}
              className="rounded-xl border border-[#29313b] bg-[#12161c] p-5"
            >
              <div className="text-xs font-semibold tracking-widest text-[#a8f56a]">
                {value}
              </div>
              <div className="mt-3 font-semibold">{title}</div>
              <div className="mt-1 text-sm text-[#a1aab7]">
                {description}
              </div>
            </div>
          ))}
        </div>
      </section>

      <section id="workspace" className="border-t border-[#29313b]">
        <div className="mx-auto max-w-7xl px-6 py-16 md:py-20">
          <div className="max-w-2xl">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#a8f56a]">
              Toolkit workspace
            </p>

            <h2 className="mt-3 text-3xl font-bold tracking-tight md:text-4xl">
              Your development tools.
            </h2>

            <p className="mt-4 leading-7 text-[#a1aab7]">
              Choose a tool to open it. Each tool has its own workspace for
              inspecting your Sails project.
            </p>
          </div>

          <div className="mt-9 grid gap-4 md:grid-cols-3">
            {tools.map((tool) => (
              <a
                key={tool.name}
                href={
                  tool.name === "IDL Explorer"
                    ? "/idl-explorer"
                    : tool.name === "Project Integrity"
                      ? "/project-integrity"
                      : tool.name === "Verification Reports"
                        ? "/verification-reports"
                        : "#workspace"
                }
                onClick={() => setActiveTool(tool.name)}
                className={`block rounded-xl border p-6 text-left transition ${
                  activeTool === tool.name
                    ? "border-[#a8f56a] bg-[#151d13]"
                    : "border-[#29313b] bg-[#12161c] hover:border-[#52614a]"
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-[#a8f56a]">
                    {tool.number} / TOOL
                  </span>

                  <span className="text-xl text-[#a8f56a]">
                    {tool.icon}
                  </span>
                </div>

                <h3 className="mt-7 text-xl font-semibold">{tool.name}</h3>

                <p className="mt-3 min-h-20 text-sm leading-6 text-[#a1aab7]">
                  {tool.description}
                </p>

                <div className="mt-5 border-t border-[#29313b] pt-4 text-xs text-[#a1aab7]">
                  {tool.status}
                  <span className="float-right">↗</span>
                </div>
              </a>
            ))}
          </div>

          <div className="mt-6 rounded-xl border border-[#29313b] bg-[#12161c] p-6 md:p-8">
            <div className="text-xs uppercase tracking-widest text-[#a8f56a]">
              Selected tool
            </div>

            <h3 className="mt-2 text-2xl font-semibold">{activeTool}</h3>

            {activeTool === "IDL Explorer" ? (
              <p className="mt-3 max-w-2xl text-sm leading-6 text-[#a1aab7]">
                Inspect Sails IDL files, explore detected declarations and
                export the parsed results as JSON.
              </p>
            ) : activeTool === "Project Integrity" ? (
              <p className="mt-3 max-w-2xl text-sm leading-6 text-[#a1aab7]">
                Inspect selected project files, identify common missing
                artifacts and review heuristic validation results.
              </p>
            ) : (
              <p className="mt-3 max-w-2xl text-sm leading-6 text-[#a1aab7]">
                Review the latest saved integrity report, inspect individual
                checks and download JSON or Markdown reports.
              </p>
            )}
          </div>
        </div>
      </section>

      <footer className="border-t border-[#29313b]">
        <div className="mx-auto flex max-w-7xl flex-col gap-2 px-6 py-7 text-sm text-[#a1aab7] sm:flex-row sm:items-center sm:justify-between">
          <span>
            Sails Developer Toolkit{" "}
            <span className="text-[#a8f56a]">·</span> Open source
          </span>
          <span>Early-stage project · Built for Vara developers</span>
        </div>
      </footer>
    </main>
  );
}
