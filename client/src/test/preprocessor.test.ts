import * as vscode from 'vscode';
import * as assert from 'assert';
import * as path from 'path';
import { activate } from './helper';

suite('Preprocessor and #include tests', () => {
	const preprocessorUri = vscode.Uri.file(path.resolve(__dirname, '../../testFixture', 'preprocessor.lsl'));
	const debugUri = vscode.Uri.file(path.resolve(__dirname, '../../testFixture', 'debug.lsl'));

	test('Included functions and defines are recognized without undeclared variable errors', async () => {
		await activate(preprocessorUri);

		// Wait for diagnostics to settle
		await new Promise(resolve => setTimeout(resolve, 2000));

		const diagnostics = vscode.languages.getDiagnostics(preprocessorUri);
		// There should be no undeclared variable errors for 'debug'
		const debugUndeclared = diagnostics.filter(d =>
			d.message.includes("'debug'") && d.message.includes('Undeclared')
		);
		assert.equal(debugUndeclared.length, 0, "Included function 'debug' should not be reported as undeclared");
	});

	test('Hover on included function shows its signature from the included file', async () => {
		await activate(preprocessorUri);

		// Line 21 (0-based 20): debug("oof");
		const hovers = (await vscode.commands.executeCommand(
			'vscode.executeHoverProvider',
			preprocessorUri,
			new vscode.Position(20, 10)
		)) as vscode.Hover[];

		assert.ok(hovers && hovers.length > 0, 'Hover should be returned for included function debug');
		const hoverTexts = hovers.map(h => h.contents.map(c => typeof c === 'string' ? c : (c as vscode.MarkdownString).value).join('\n')).join('\n');
		assert.ok(hoverTexts.includes('debug'), `Expected hover to include 'debug', got: ${hoverTexts}`);
	});

	test('Completion list includes functions and defines from included file', async () => {
		await activate(preprocessorUri);

		const completionList = (await vscode.commands.executeCommand(
			'vscode.executeCompletionItemProvider',
			preprocessorUri,
			new vscode.Position(21, 0)
		)) as vscode.CompletionList;

		assert.ok(completionList && completionList.items.length > 0, 'Completion items should be returned');
		const hasDebug = completionList.items.some(item => item.label === 'debug');
		assert.ok(hasDebug, "Completion items should include 'debug' from debug.lsl");
	});

	test('Go to definition on included function resolves to the included file', async () => {
		await activate(preprocessorUri);

		// Line 21 (0-based 20): debug("oof");
		const definitions = (await vscode.commands.executeCommand(
			'vscode.executeDefinitionProvider',
			preprocessorUri,
			new vscode.Position(20, 10)
		)) as (vscode.Location | vscode.LocationLink)[];

		assert.ok(definitions && definitions.length > 0, 'Definition should be returned for debug');
		const defUri = 'targetUri' in definitions[0] ? definitions[0].targetUri : (definitions[0] as vscode.Location).uri;
		assert.ok(
			defUri.fsPath.toLowerCase().endsWith('debug.lsl'),
			`Expected definition to point to debug.lsl, got: ${defUri.fsPath}`
		);
	});
});
