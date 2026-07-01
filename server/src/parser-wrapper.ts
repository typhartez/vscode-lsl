/* --------------------------------------------------------------------------------------------
 * Parser wrapper for Tailslide WASM module to provide diagnostics
 * ------------------------------------------------------------------------------------------ */
import type { Diagnostic } from 'vscode-languageserver/node';
import { Position, DiagnosticSeverity } from 'vscode-languageserver/node';
import path from 'path';

// Note: when running from server/out/, the path resolves to server/src/parser/
// @ts-expect-error No types
import TailslideModuleExport from '../src/parser/tailslide.js';

// Lazy-load the WASM module - it will be initialized once
let errorCollector: { line: number; character: number; message: string; code: string }[] = [];

// Lazy-load the WASM module - it will be initialized once
let parserModule: any = null;

/**
 * Initialize the Tailslide WASM parser module
 */
export async function initParser(): Promise<void> {
    if (parserModule) return;

    // Use require for CommonJS compatibility - parser is in server/src/parser/

    // Create a print handler function
    const printHandler = (msg: string) => {
        // Parse error format: ERROR:: ( <line>, <col>): [<code>] <message>
        const errorMatch = msg.match(/^ERROR::\s*\(\s*(\d+),\s*(\d+)\):\s*\[(\w+)\]\s*(.+)$/);
        if (errorMatch) {
            errorCollector.push({
                line: parseInt(errorMatch[1], 10) - 1, // Convert to 0-based
                character: parseInt(errorMatch[2], 10) - 1, // Convert to 0-based
                code: errorMatch[3],
                message: errorMatch[4]
            });
        }
    };

    // Determine the exact export format Emscripten used
    if (typeof TailslideModuleExport === 'function') {
        parserModule = await TailslideModuleExport({
            locateFile: (p: string) => path.join(__dirname, '../src/parser', p),
            noInitialRun: true,
            print: printHandler,
            printErr: printHandler
        });
    } else if (TailslideModuleExport.default && typeof TailslideModuleExport.default === 'function') {
        parserModule = await TailslideModuleExport.default({
            locateFile: (p: string) => path.join(__dirname, '../src/parser', p),
            noInitialRun: true,
            print: printHandler,
            printErr: printHandler
        });
    } else if (TailslideModuleExport.Module && typeof TailslideModuleExport.Module === 'function') {
        parserModule = await TailslideModuleExport.Module({
            locateFile: (p: string) => path.join(__dirname, '../src/parser', p),
            noInitialRun: true,
            print: printHandler,
            printErr: printHandler
        });
    } else {
        throw new TypeError("Could not find an executable Emscripten factory function in the exports.");
    }
}

/**
 * Parse LSL code and return diagnostics
 */
export async function parseLSL(text: string): Promise<Diagnostic[]> {
    if (!parserModule) {
        await initParser();
    }

    if (!parserModule) {
        return [];
    }

    // Clear the collector for this run
    errorCollector = [];

    const diagnostics: Diagnostic[] = [];

    try {
        // Write content to Emscripten virtual filesystem
        parserModule.FS.writeFile('/diagnostic.lsl', text);
        parserModule.callMain(['diagnostic.lsl']);
    } catch (e: any) {
        // ExitStatus exceptions are expected for normal parser exit
        if (e.name !== 'ExitStatus' && e.name !== 'exit') {
            console.error('Parser error:', e);
        }
    }

    // Convert to LSP diagnostics
    for (const error of errorCollector) {
        diagnostics.push({
            severity: DiagnosticSeverity.Error,
            range: {
                start: Position.create(error.line, error.character),
                end: Position.create(error.line, error.character)
            },
            message: error.message,
            code: error.code,
            source: 'vscode-lsl'
        });
    }

    return diagnostics;
}