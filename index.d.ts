/// <reference types="node" />
export class Reader {}
export interface Reader extends NodeJS.ReadableStream {}
export interface WriterOptions {
    channels?: number;
    sampleRate?: number;
    bitDepth?: number;
}
export class Writer {
    constructor(options: WriterOptions);
}
export type FileWriterOptions = WriterOptions & Exclude<Parameters<typeof import('fs')['createWriteStream']>[1], string>;
export interface Writer extends NodeJS.WritableStream {}
export class FileWriter {
    constructor(path: string, options?: FileWriterOptions);
}
export interface FileWriter extends NodeJS.WritableStream {}
