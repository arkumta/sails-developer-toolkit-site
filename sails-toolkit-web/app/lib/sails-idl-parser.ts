
import type { IIdlDoc } from "./official-sails-types/idl-v2-types";
import { SailsIdlParser } from "./official-sails-parser/index.js";

export type IDLEntry = {
  name: string;
  detail: string;
};

export type ParsedIDL = {
  version: string;
  warnings: string[];
  services: IDLEntry[];
  functions: IDLEntry[];
  constructors: IDLEntry[];
  types: IDLEntry[];
  events: IDLEntry[];
  programs: IDLEntry[];
  serviceIds: string[];
};

let parserPromise: Promise<SailsIdlParser> | null = null;

async function getParser(): Promise<SailsIdlParser> {
  if (!parserPromise) {
    const parser = new SailsIdlParser();

    parserPromise = parser
      .init()
      .then(() => parser)
      .catch((error) => {
        parserPromise = null;
        throw error;
      });
  }

  return parserPromise;
}

function describe(value: unknown): string {
  if (value === undefined || value === null) return "";

  if (typeof value === "string") return value;

  return (
    JSON.stringify(value, (_, item) =>
      typeof item === "bigint" ? item.toString() : item,
    ) ?? String(value)
  );
}

function formatInterfaceId(value: unknown): string {
  if (!value) return "";

  if (typeof value === "string") return value;

  let bytes: Uint8Array | null = null;

  if (value instanceof Uint8Array) {
    bytes = value;
  } else if (
    typeof value === "object" &&
    value !== null &&
    "bytes" in value &&
    (value as { bytes: unknown }).bytes instanceof Uint8Array
  ) {
    bytes = (value as { bytes: Uint8Array }).bytes;
  }

  if (bytes) {
    return `0x${Array.from(bytes)
      .map((byte) => byte.toString(16).padStart(2, "0"))
      .join("")}`;
  }

  return describe(value);
}

export async function parseSailsIDL(
  source: string,
): Promise<ParsedIDL> {
  if (!source.trim()) {
    throw new Error("Please provide a Sails IDL file.");
  }

  const header = source.match(
    /^\s*!@sails:\s*(\d+\.\d+\.\d+)/m,
  );

  const parser = await getParser();

  // Official Sails IDL v2 parsing and validation.
  const document = parser.parse(source) as IIdlDoc;

  const services = document.services ?? [];
  const program = document.program;
  const exportedServices = program?.services ?? [];

  const serviceIds = [
    ...services.map((service) =>
      formatInterfaceId(service.interface_id),
    ),
    ...exportedServices.map((service) =>
      formatInterfaceId(service.interface_id),
    ),
  ].filter(Boolean);

  const serviceEntries: IDLEntry[] = [
    ...services.map((service) => ({
      name: service.name,
      detail: service.interface_id
        ? `Interface ID: ${formatInterfaceId(service.interface_id)}`
        : "Service declaration",
    })),

    ...exportedServices.map((service) => ({
      name: service.name,
      detail: [
        service.route ? `Route: ${service.route}` : "",
        `Route index: ${service.route_idx}`,
        service.interface_id
          ? `Interface ID: ${formatInterfaceId(service.interface_id)}`
          : "",
      ]
        .filter(Boolean)
        .join(" · "),
    })),
  ];

  const functions: IDLEntry[] = services.flatMap((service) =>
    (service.funcs ?? []).map((func) => ({
      name: `${service.name}.${func.name}`,
      detail: [
        func.kind,
        `(${(func.params ?? [])
          .map(
            (param) =>
              `${param.name}: ${describe(param.type)}`,
          )
          .join(", ")})`,
        `→ ${describe(func.output)}`,
        func.entry_id !== undefined
          ? `Entry ID: ${func.entry_id}`
          : "",
      ]
        .filter(Boolean)
        .join(" · "),
    })),
  );

  const constructors: IDLEntry[] = (program?.ctors ?? []).map(
    (ctor) => ({
      name: ctor.name,
      detail: `(${(ctor.params ?? [])
        .map(
          (param) =>
            `${param.name}: ${describe(param.type)}`,
        )
        .join(", ")})`,
    }),
  );

  const types: IDLEntry[] = [
    ...services.flatMap((service) =>
      (service.types ?? []).map((type) => ({
        name: type.name,
        detail: describe(type),
      })),
    ),

    ...(program?.types ?? []).map((type) => ({
      name: type.name,
      detail: describe(type),
    })),
  ];

  const events: IDLEntry[] = services.flatMap((service) =>
    (service.events ?? []).map((event) => ({
      name: `${service.name}.${event.name}`,
      detail: describe(event.fields),
    })),
  );

  return {
    version: header?.[1] ?? "2.0.0",
    warnings: [],
    services: serviceEntries,
    functions,
    constructors,
    types,
    events,
    programs: program
      ? [
          {
            name: program.name,
            detail: "Sails program",
          },
        ]
      : [],
    serviceIds: [...new Set(serviceIds)],
  };
}
