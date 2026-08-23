/* --------------------------------------------------------------------------------------------
 * Parser wrapper for Tailslide WASM module to provide diagnostics
 * ------------------------------------------------------------------------------------------ */
import type { Diagnostic } from 'vscode-languageserver/node';
import { Position, DiagnosticSeverity } from 'vscode-languageserver/node';
import path from 'path';

// Lazy-load the WASM module - it will be initialized once
// Supports format: ERROR:: (line, col)-(endLine, endCol): [code] message
let errorCollector: { startLine: number; startCharacter: number; endLine: number; endCharacter: number; message: string; code: string }[] = [];

// Lazy-load the WASM module - it will be initialized once
let parserModule: any = null;

/**
 * Initialize the Tailslide WASM parser module
 */
export async function initParser(): Promise<void> {
    if (parserModule) return;

    // Use require for CommonJS compatibility - parser is in server/src/parser/
    // Note: when running from server/out/, the path resolves to server/src/parser/
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const TailslideModuleExport = require('../src/parser/tailslide.js');

    // Create a print handler function
    const printHandler = (msg: string) => {
        // Parse error format: ERROR:: (line, col)-(endLine, endCol): [code] message
        const diagnosticRegex = /(ERROR|WARN)::\s*\((\d+),(\d+)\)-\((\d+),(\d+)\):\s*\[(\w+)\]\s*(.+)$/;
        const errorMatch = msg.match(diagnosticRegex);
        if (errorMatch) {
            errorCollector.push({
                startLine: parseInt(errorMatch[2], 10) - 1, // Convert to 0-based
                startCharacter: parseInt(errorMatch[3], 10) - 1, // Convert to 0-based
                endLine: parseInt(errorMatch[4], 10) - 1, // Convert to 0-based
                endCharacter: parseInt(errorMatch[5], 10) - 1, // Convert to 0-based
                code: errorMatch[6],
                message: errorMatch[7]
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
 * Replaces preprocessor directive lines with empty lines so the Tailslide parser
 * (which does not understand Firestorm/LSL preprocessor syntax) won't error on them.
 * Line numbers are preserved so diagnostic positions stay accurate.
 */
function stripPreprocessorDirectives(text: string): string {
    const preprocessorLineRe = /^\s*#(define|include|if|ifdef|ifndef|elif|else|endif|undef|pragma|warning|error)\b/;
    const lines = text.split('\n');
    let inMultiLineDefine = false;
    const result = lines.map(line => {
        // A multi-line #define continuation ends when the line does NOT end with backslash
        const trimmed = line.trimEnd();
        if (inMultiLineDefine) {
            if (!trimmed.endsWith('\\')) {
                inMultiLineDefine = false;
            }
            return '';
        }
        if (preprocessorLineRe.test(line)) {
            // If this line ends with backslash it continues onto the next line(s)
            if (trimmed.endsWith('\\')) {
                inMultiLineDefine = true;
            }
            return '';
        }
        return line;
    });
    return result.join('\n');
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
        // Strip preprocessor directive lines before parsing — Tailslide does not understand
        // Firestorm/LSL preprocessor directives (#define, #include, #if, etc.).
        // Replace them with empty lines to preserve line numbers for accurate diagnostics.
        const strippedText = stripPreprocessorDirectives(text);
        // Write content to Emscripten virtual filesystem
        parserModule.FS.writeFile('/diagnostic.lsl', strippedText);
        parserModule.callMain(['diagnostic.lsl']);
    } catch (e: unknown) {
        // ExitStatus exceptions are expected for normal parser exit
        const error = e as { name?: string };
        if (error.name !== 'ExitStatus' && error.name !== 'exit') {
            console.error('Parser error:', e);
        }
    }

    // Collect all #define names from the document to ignore undeclared errors (E10006) for them
    const preprocessorDefines = new Set<string>();
    const lines = text.split('\n');
    lines.forEach((line) => {
        const trimmedLine = line.trim();
        if (trimmedLine.startsWith('#define')) {
            const afterDefine = trimmedLine.substring(7).trim();
            const defineNameMatch = afterDefine.match(/^([a-zA-Z_][a-zA-Z0-9_]*)/);
            if (defineNameMatch) {
                preprocessorDefines.add(defineNameMatch[1]);
            }
        }
    });

    // Convert to LSP diagnostics
    // Ignore E20009
    for (const error of errorCollector) {
        if (error.code === 'E20009') continue;
        if (error.code === 'E10006') {
            // E10006 message format: `identifier' is undeclared.
            const undeclaredMatch = error.message.match(/^`([^']+)' is undeclared/);
            if (undeclaredMatch && preprocessorDefines.has(undeclaredMatch[1])) {
                continue;
            }
        }
        if (['E20007'].includes(error.code)) {
            diagnostics.push({
                severity: DiagnosticSeverity.Warning,
                range: {
                    start: Position.create(error.startLine, error.startCharacter),
                    end: Position.create(error.endLine, error.endCharacter)
                },
                message: error.message,
                code: error.code,
                source: 'vscode-lsl'
            });
        } else {
            diagnostics.push({
                severity: DiagnosticSeverity.Error,
                range: {
                    start: Position.create(error.startLine, error.startCharacter),
                    end: Position.create(error.endLine, error.endCharacter)
                },
                message: error.message,
                code: error.code,
                source: 'vscode-lsl'
            });
        }
    }

    return diagnostics;
}
