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

	assert.equal(actualDiagnostics.length, expectedDiagnostics.length);

	expectedDiagnostics.forEach((expectedDiagnostic, i) => {
		const actualDiagnostic = actualDiagnostics[i];
		assert.equal(actualDiagnostic.message, expectedDiagnostic.message);
		assert.deepEqual(actualDiagnostic.range, expectedDiagnostic.range);
		assert.equal(actualDiagnostic.severity, expectedDiagnostic.severity);
	});
}