export declare class WasmParseError extends Error {
    constructor(message: string);
}
export declare class EnvelopeDecodeError extends Error {
    constructor(message: string);
}
export declare class EnvelopeSizeError extends Error {
    constructor(message?: string);
}
export declare class EnvelopeUtf8Error extends Error {
    constructor(message: string);
}
type WasmInput = Uint8Array | ArrayBuffer | Blob;
export declare const extractIdlFromWasm: (input: WasmInput) => Promise<string | null>;
export {};
