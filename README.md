# Sails Developer Toolkit

A web-based workspace of developer utilities for building and inspecting projects in the Sails ecosystem on Vara Network.

**Website:** https://sails-developer-toolkit-site.vercel.app/

## Tools

### 1. IDL Explorer
Inspect Sails Interface Definition Language (IDL) files.

- Upload or paste IDL source.
- Inspect services, functions, constructors, custom types, events and programs.
- Identify supported syntax and validation issues.
- Export parsed results as JSON.

Note: The current parser implements a subset of IDL syntax and validation. It is not a complete implementation of the official Sails IDL specification.

### 2. Project Integrity
Run preliminary checks on selected project files.

- Inspect project files such as Cargo.toml, Rust source and IDL files.
- Review detected configuration and project structure.
- Identify potential missing files and warnings.

Note: These checks are heuristic. They do not replace Cargo compilation, automated testing, WASM validation or a security audit.

### 3. Verification Reports
Review and export project-check results.

- View collected verification results.
- Review passed checks and warnings.
- Export reports in JSON and Markdown formats.

## Getting Started

### Requirements

- Node.js
- npm

### Installation

Clone the repository:

```bash
git clone https://github.com/arkumta/sails-developer-toolkit-site.git
cd sails-developer-toolkit-site/sails-toolkit-web
```

Install dependencies:

```bash
npm install
```

Start the development server:

```bash
npm run dev
```

Open http://localhost:3000 in your browser.

## Project Structure

```text
sails-developer-toolkit-site/
├── LICENSE
├── README.md
└── sails-toolkit-web/
    ├── app/
    │   ├── idl-explorer/
    │   ├── project-integrity/
    │   ├── verification-reports/
    │   └── lib/
    ├── tests/
    └── package.json
```

## Running Tests

From the `sails-toolkit-web` directory:

```bash
node --test tests/sails-idl-parser.test.mjs
```

## Production Build

From the `sails-toolkit-web` directory:

```bash
npm run build
```

## Current Status

Sails Developer Toolkit is an evolving project. Its tools are under active development, and their checks should be treated as preliminary until independently validated against real Sails projects and developer workflows.

Bug reports, feedback and contributions are welcome.

## License

This project is licensed under the MIT License. See the [LICENSE](LICENSE) file for details.

Copyright (c) 2026 Akhmi
