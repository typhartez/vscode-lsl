/* --------------------------------------------------------------------------------------------
 * Copyright (c) Microsoft Corporation. All rights reserved.
 * Licensed under the MIT License. See License.txt in the project root for license information.
 * ------------------------------------------------------------------------------------------ */

import * as vscode from 'vscode';
import * as assert from 'assert';
import * as path from 'path';
import { activate } from './helper';

suite('Should get diagnostics', () => {
	test('Detects undeclared variables', async () => {
		const docUri = vscode.Uri.file(path.resolve(__dirname, '../../testFixture', 'diagnostics.lsl'));
		await testDiagnostics(docUri, [
			{ message: "Undeclared variable 'undefinedVar'", range: toRange(5, 13, 5, 25), severity: vscode.DiagnosticSeverity.Error, source: 'lsl' }
		]);
	});

	test('Detects missing default state', async () => {
		const docUri = vscode.Uri.file(path.resolve(__dirname, '../../testFixture', 'missing-default.lsl'));
		await testDiagnostics(docUri, [
			{ message: 'LSL script is missing a default state', range: toRange(0, 0, 0, 1), severity: vscode.DiagnosticSeverity.Error, source: 'lsl' }
		]);
	});

	test('Detects multiple default states', async () => {
		const docUri = vscode.Uri.file(path.resolve(__dirname, '../../testFixture', 'double-default.lsl'));
		await testDiagnostics(docUri, [
			{ message: 'Multiple default states defined', range: toRange(13, 0, 13, 7), severity: vscode.DiagnosticSeverity.Error, source: 'lsl' }
		]);
	});

	test('Detects unused user-defined functions', async () => {
		const docUri = vscode.Uri.file(path.resolve(__dirname, '../../testFixture', 'unused-vars.lsl'));
		await testDiagnostics(docUri, [
			{ message: "Variable 'unusedVar' is set but never read", range: toRange(3, 8, 3, 17), severity: vscode.DiagnosticSeverity.Warning, source: 'lsl' },
			{ message: "Variable 'unsetVar' is declared but never used", range: toRange(2, 8, 2, 16), severity: vscode.DiagnosticSeverity.Hint, source: 'lsl' },
			{ message: "Unused function 'myFunc'", range: toRange(8, 8, 8, 14), severity: vscode.DiagnosticSeverity.Hint, source: 'lsl' },
			{ message: "Unused function 'myOtherFunc'", range: toRange(12, 0, 12, 10), severity: vscode.DiagnosticSeverity.Hint, source: 'lsl' },
		]);
	});

	test('Detects missing semicolons', async () => {
		const docUri = vscode.Uri.file(path.resolve(__dirname, '../../testFixture', 'missing-semi.lsl'));
		await testDiagnostics(docUri, [
			{ message: 'Missing semicolon', range: toRange(4, 26, 4, 26), severity: vscode.DiagnosticSeverity.Error, source: 'lsl' }, // llSay in state_entry
			{ message: 'Missing semicolon', range: toRange(5, 13, 5, 13), severity: vscode.DiagnosticSeverity.Error, source: 'lsl' }, // integer i = 5
			{ message: 'Missing semicolon', range: toRange(6, 21, 6, 21), severity: vscode.DiagnosticSeverity.Error, source: 'lsl' }, // llOwnerSay
			{ message: 'Missing semicolon', range: toRange(11, 20, 11, 20), severity: vscode.DiagnosticSeverity.Error, source: 'lsl' }, // llSay in touch_start
		]);
	});
});

function toRange(sLine: number, sChar: number, eLine: number, eChar: number) {
	const start = new vscode.Position(sLine, sChar);
	const end = new vscode.Position(eLine, eChar);
	return new vscode.Range(start, end);
}

async function testDiagnostics(docUri: vscode.Uri, expectedDiagnostics: vscode.Diagnostic[]) {
	await activate(docUri);

	// Wait a bit longer for diagnostics to be computed
	await new Promise(resolve => setTimeout(resolve, 2000));

	const actualDiagnostics = vscode.languages.getDiagnostics(docUri);

	assert.equal(actualDiagnostics.length, expectedDiagnostics.length,
		`Expected ${expectedDiagnostics.length} diagnostics, got ${actualDiagnostics.length}`);

	// Check each expected diagnostic exists (order-independent)
	expectedDiagnostics.forEach((expectedDiagnostic) => {
		const found = actualDiagnostics.some((actual) =>
			actual.message === expectedDiagnostic.message &&
			actual.range.start.line === expectedDiagnostic.range.start.line &&
			actual.range.start.character === expectedDiagnostic.range.start.character &&
			actual.range.end.line === expectedDiagnostic.range.end.line &&
			actual.range.end.character === expectedDiagnostic.range.end.character &&
			actual.severity === expectedDiagnostic.severity
		);
		assert.ok(found, `Expected diagnostic "${expectedDiagnostic.message}" not found`);
	});
}