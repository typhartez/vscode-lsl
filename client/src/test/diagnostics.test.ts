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
			{ message: "Undeclared variable 'undefinedVar'", range: toRange(7, 16, 7, 28), severity: vscode.DiagnosticSeverity.Error, source: 'lsl' }
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