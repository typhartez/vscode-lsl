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

import { scanDocumentForVariables, scanDocumentForUserFunctions } from './scanner';
import { LSLType } from './lslTypes';

/**
 * Replaces Firestorm lazy list indexing syntax (e.g. `myList[2]`) with
 * space-padded text so that the Tailslide parser — which does not understand
 * this Firestorm preprocessor extension — won't report syntax errors for the
 * `[` token or produce cascading parse errors on the same line.
 *
 * The replacement preserves the original character count (by padding with
 * spaces), so line/column offsets in any remaining diagnostics still match
 * the original source positions.
 */
function transformLazyListSyntax(text: string, listVariableNames: Set<string>): string {
    if (listVariableNames.size === 0) return text;
    let result = text;
    for (const name of listVariableNames) {
        // Match: listVar [ index ]  (whitespace around brackets is optional)
        const re = new RegExp(`\\b${escapeRegExp(name)}\\s*\\[([^\\]]*)\\]`, 'g');
        result = result.replace(re, (match) => {
            return name + ' '.repeat(match.length - name.length);
        });
    }
    return result;
}

function escapeRegExp(s: string): string {
    return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Parse LSL code and return diagnostics
 */
export async function parseLSL(text: string, documentUri?: string): Promise<Diagnostic[]> {
    if (!parserModule) {
        await initParser();
    }

    if (!parserModule) {
        return [];
    }

    // Clear the collector for this run
    errorCollector = [];

    const diagnostics: Diagnostic[] = [];

    // Collect all #define names and included symbols to ignore undeclared errors (E10006) for them
    const preprocessorDefines = new Set<string>();
    // Collect names of `list` variables to support Firestorm's lazy list indexing syntax
    // (e.g. myList[2] = "c"), which Tailslide does not understand and reports as E10020.
    const listVariableNames = new Set<string>();
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

    if (documentUri) {
        const includedVars = scanDocumentForVariables(text, documentUri);
        Object.values(includedVars).forEach((v) => {
            preprocessorDefines.add(v.name);
            if (v.type === LSLType.List) {
                listVariableNames.add(v.name);
            }
        });
        const includedFuncs = scanDocumentForUserFunctions(text, documentUri);
        Object.keys(includedFuncs).forEach((fn) => {
            preprocessorDefines.add(fn);
        });
    }

    try {
        // Strip preprocessor directive lines before parsing — Tailslide does not understand
        // Firestorm/LSL preprocessor directives (#define, #include, #if, etc.).
        // Replace them with empty lines to preserve line numbers for accurate diagnostics.
        let parseText = stripPreprocessorDirectives(text);
        // Transform Firestorm's lazy list indexing syntax (listVar[index]) into
        // space-padded text so Tailslide doesn't report E10020 syntax errors for
        // the '[' token, nor produce cascading errors on the same line.
        parseText = transformLazyListSyntax(parseText, listVariableNames);
        // Write content to Emscripten virtual filesystem
        parserModule.FS.writeFile('/diagnostic.lsl', parseText);
        parserModule.callMain(['diagnostic.lsl']);
    } catch (e: unknown) {
        // ExitStatus exceptions are expected for normal parser exit
        const error = e as { name?: string };
        if (error.name !== 'ExitStatus' && error.name !== 'exit') {
            console.error('Parser error:', e);
        }
    }

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
        if (error.code === 'E10020' && error.message.includes("unexpected '['")) {
            // Safety net: if Tailslide still reports an unexpected '[' and the
            // identifier immediately before it is a declared `list` variable
            // (Firestorm lazy list indexing syntax), suppress the diagnostic.
            const line = lines[error.startLine];
            if (line !== undefined) {
                const before = line.slice(0, error.startCharacter);
                const idMatch = before.match(/([a-zA-Z_][a-zA-Z0-9_]*)\s*$/);
                if (idMatch && listVariableNames.has(idMatch[1])) {
                    continue;
                }
            }
        }
        if (error.code === 'E10002' && /^Invalid operator: list =/.test(error.message)) {
            // Suppresses type-mismatch errors introduced by the lazy-list
            // transformation: listVar[index] = value  →  listVar    = value
            // which Tailslide correctly flags as "list = <type>". The original
            // line still contains the lazy-list pattern (listVar[) so we can
            // identify these as transformation side-effects.
            const line = lines[error.startLine];
            if (line !== undefined && Array.from(listVariableNames).some(name =>
                new RegExp(`\\b${escapeRegExp(name)}\\s*\\[`).test(line)
            )) {
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
