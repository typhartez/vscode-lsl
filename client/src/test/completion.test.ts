import * as vscode from 'vscode';
import * as assert from 'assert';
import { getDocUri, activate } from './helper';

suite('Should do completion', () => {
	const docUri = getDocUri('preprocessor.lsl');

	test('Completes functions, constants, and included symbols', async () => {
		await activate(docUri);

		const actualCompletionList = (await vscode.commands.executeCommand(
			'vscode.executeCompletionItemProvider',
			docUri,
			new vscode.Position(20, 0)
		)) as vscode.CompletionList;

		assert.ok(actualCompletionList.items.length >= 2, 'Should return completion items');
		const labels = actualCompletionList.items.map(item => item.label);
		assert.ok(labels.includes('debug'), "Completion list should include 'debug' from included file");
		assert.ok(labels.includes('llOwnerSay'), "Completion list should include 'llOwnerSay'");
		assert.ok(labels.includes('PUBLIC_CHANNEL'), "Completion list should include 'PUBLIC_CHANNEL'");
	});
});
