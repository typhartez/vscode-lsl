// Debug file to test scanner logic
import { scanDocumentForVariables } from './scanner';
import getScopes from './scopes';
import getQuoteRanges from './quoteRanges';
import getCommentedOutSections from './comments';

const testScript = `// LSL script for testing undeclared variable detection

integer declaredVar = 10;

default
{
    state_entry()
    {
        // This should be flagged - undefinedVar is not declared
        integer result = undefinedVar + 5;

        // This should NOT be flagged - declaredVar is in scope
        integer x = declaredVar + 10;

        // This should be flagged - anotherUndeclared is not declared
        llSay(0, anotherUndeclared);
    }
}`;

const variables = scanDocumentForVariables(testScript);
console.log('Variables found:');
Object.entries(variables).forEach(([key, v]) => {
  console.log(`  ${key}: ${v.name} at line ${v.line}, col ${v.column}`);
});

// Check the line analysis
const lines = testScript.split('\n');
const typePattern = /^integer\s+([a-zA-Z_][a-zA-Z0-9_]*)/i;
lines.forEach((line, lineNum) => {
  const match = line.match(typePattern);
  if (match) {
    console.log(`Line ${lineNum}: Found declaration "${match[1]}" at position ${line.indexOf(match[1])}`);
  }
});