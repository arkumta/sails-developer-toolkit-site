import { IIdlDoc } from 'sails-js-types';
export declare class SailsIdlParser {
    private _memory;
    private _instance;
    private _exports;
    private _encoder;
    private _decoder;
    private _idlPtr;
    private _idlLen;
    private _numberOfGrownPages;
    constructor();
    private _decompressWasm;
    private fillMemory;
    private clearMemory;
    private readCString;
    init(): Promise<void>;
    parse(idl: string): IIdlDoc;
}
