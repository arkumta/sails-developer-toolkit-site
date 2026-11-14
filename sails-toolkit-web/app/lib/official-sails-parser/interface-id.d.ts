import type { InterfaceIdInput, IInterfaceId } from 'sails-js-types';
export declare class InterfaceId implements IInterfaceId {
    readonly bytes: Uint8Array;
    private constructor();
    static zero(): InterfaceId;
    static fromBytes(bytes: ArrayLike<number>): InterfaceId;
    static fromU64(value: bigint | number): InterfaceId;
    static fromString(value: string): InterfaceId;
    static tryReadBytes(bytes: Uint8Array, offset?: number): {
        id: InterfaceId;
        offset: number;
    };
    static tryFromBytes(bytes: Uint8Array): InterfaceId;
    static from(input: InterfaceIdInput): InterfaceId;
    from(input: InterfaceIdInput): InterfaceId;
    asU64(): bigint;
    toString(): string;
    toJSON(): string;
    private static isInterfaceIdLike;
}
