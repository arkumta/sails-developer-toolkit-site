import { InterfaceId } from './interface-id';
export declare const HIGHEST_SUPPORTED_VERSION = 1;
export declare const MAGIC_BYTES: Uint8Array<ArrayBuffer>;
export declare const MINIMAL_HLEN = 16;
export declare class SailsMessageHeader {
    readonly version: number;
    readonly hlen: number;
    readonly interfaceId: InterfaceId;
    readonly routeIdx: number;
    readonly entryId: number;
    private constructor();
    static new(version: number, hlen: number, interfaceId: InterfaceId, routeIdx: number, entryId: number): SailsMessageHeader;
    static v1(interfaceId: InterfaceId, entryId: number, routeIdx: number): SailsMessageHeader;
    toBytes(): Uint8Array;
    static tryReadBytes(bytes: Uint8Array, offset?: number): {
        header: SailsMessageHeader;
        offset: number;
    };
    static tryFromBytes(bytes: Uint8Array): {
        ok: boolean;
        header: SailsMessageHeader | undefined;
    };
}
