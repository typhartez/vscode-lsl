import * as vscode from 'vscode';
import * as assert from 'assert';
import * as path from 'path';
import { activate } from './helper';

suite('Should get hover information', () => {
	const docUri = vscode.Uri.file(path.resolve(__dirname, '../../testFixture', 'issue14.lsl'));

	test('Hover on preprocessor defined variable shows its value', async () => {
		await activate(docUri);

		// Line 229 (0-based 228): llMessageLinked(sendTo, reason, (string)col, IDENTIFIER);
		// IDENTIFIER is at col 49
		const hovers = (await vscode.commands.executeCommand(
			'vscode.executeHoverProvider',
			docUri,
			new vscode.Position(228, 50)
		)) as vscode.Hover[];

		assert.ok(hovers && hovers.length > 0, 'Hover should be returned for IDENTIFIER');
		const hoverTexts = hovers.map(h => h.contents.map(c => typeof c === 'string' ? c : (c as vscode.MarkdownString).value).join('\n')).join('\n');
		assert.ok(hoverTexts.includes('#define IDENTIFIER "ColorPicker"'), `Expected hover to include '#define IDENTIFIER "ColorPicker"', got: ${hoverTexts}`);
	});

	test('Hover on preprocessor variable with comment shows value and comment', async () => {
		await activate(docUri);

		// Line 75 (0-based 74): integer mode = MODE_SV_H;
		// MODE_SV_H is at col 15
		const hovers = (await vscode.commands.executeCommand(
			'vscode.executeHoverProvider',
			docUri,
			new vscode.Position(74, 17)
		)) as vscode.Hover[];

		assert.ok(hovers && hovers.length > 0, 'Hover should be returned for MODE_SV_H');
		const hoverTexts = hovers.map(h => h.contents.map(c => typeof c === 'string' ? c : (c as vscode.MarkdownString).value).join('\n')).join('\n');
		assert.ok(hoverTexts.includes('#define MODE_SV_H FALSE'), `Expected hover to include '#define MODE_SV_H FALSE', got: ${hoverTexts}`);
		assert.ok(hoverTexts.includes('saturation/value on palette, hue on bar'), `Expected hover to include comment, got: ${hoverTexts}`);
	});

	test('Hover on function-like preprocessor macro shows macro signature and body', async () => {
		await activate(docUri);

		// Line 89 (0-based 88): #define DBG(_msg)       llOwnerSay(_msg)
		// DBG is at col 8
		const hovers = (await vscode.commands.executeCommand(
			'vscode.executeHoverProvider',
			docUri,
			new vscode.Position(88, 10)
		)) as vscode.Hover[];

		assert.ok(hovers && hovers.length > 0, 'Hover should be returned for DBG');
		const hoverTexts = hovers.map(h => h.contents.map(c => typeof c === 'string' ? c : (c as vscode.MarkdownString).value).join('\n')).join('\n');
		assert.ok(hoverTexts.includes('#define DBG(_msg) llOwnerSay(_msg)'), `Expected hover to include '#define DBG(_msg) llOwnerSay(_msg)', got: ${hoverTexts}`);
	});
});
