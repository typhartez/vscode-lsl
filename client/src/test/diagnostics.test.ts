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
	
	test('Detects missing semicolons', async () => {
		const docUri = vscode.Uri.file(path.resolve(__dirname, '../../testFixture', 'missing-semi.lsl'));
		await testDiagnostics(docUri, [
			{ message: 'Missing semicolon', range: toRange(4, 26, 4, 26), severity: vscode.DiagnosticSeverity.Error, source: 'lsl' }, // llSay in state_entry
			{ message: 'Missing semicolon', range: toRange(5, 13, 5, 13), severity: vscode.DiagnosticSeverity.Error, source: 'lsl' }, // integer i = 5
			{ message: 'Missing semicolon', range: toRange(6, 21, 6, 21), severity: vscode.DiagnosticSeverity.Error, source: 'lsl' }, // llOwnerSay
			{ message: 'Missing semicolon', range: toRange(11, 20, 11, 20), severity: vscode.DiagnosticSeverity.Error, source: 'lsl' }, // llSay in touch_start
		]);
	});

	test('Accepts empty lines after default / state without unused function warnings', async () => {
		const docUri = vscode.Uri.file(path.resolve(__dirname, '../../testFixture', 'empty-line-after-state.lsl'));
		await testDiagnostics(docUri, []);
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