import fs from 'fs';
import getCommentedOutSections from './comments';
import { LSLType, LSLVariable, LSLFunctionCall, LSLFunction } from './lslTypes';
import getQuoteRanges from './quoteRanges';
import { convertToType } from './types';
import getScopes from './scopes';

export type Variables = { [key: string]: LSLVariable };

export const scanDocumentForUserFunctions = (document: string): { [name: string]: LSLFunction } => {
  const userFunctions: { [name: string]: LSLFunction } = {};
  const scopes = getScopes(document);
  const lines = document.split('\n');

  let foundFirstState = false;

  const filteredScopes = scopes.scopes.filter(
    (scope) =>
      !scope.name ||
      !(
        ['if', 'else if', 'else', 'for', 'while', 'do', 'switch'].includes(
          scope.name
        ) ||
        scope.name.startsWith('case ') ||
        scope.name.startsWith('#define ')
      )
  );

  filteredScopes.forEach((scope) => {
    if (scope.name) {
      if (scope.name === 'default' || scope.name.startsWith('state ')) {
        foundFirstState = true;
      } else if (!foundFirstState) {
        // User defined function
        const functionName = scope.name.trim();
        if (!functionName) return;

        let signatureText = '';
        if (scope.nameStartLine !== undefined) {
          if (scope.nameStartLine === scope.startLine) {
            signatureText = lines[scope.startLine].substring(0, scope.startCol);
          } else {
            signatureText = lines[scope.nameStartLine];
            for (let i = scope.nameStartLine + 1; i < scope.startLine; i++) {
              signatureText += ' ' + lines[i];
            }
            signatureText += ' ' + lines[scope.startLine].substring(0, scope.startCol);
          }
        }

        const args: any[] = [];
        let returnType = LSLType.Void;

        const argsMatch = signatureText.match(/\((.*)\)/);
        let textBeforeParen = signatureText;
        if (argsMatch) {
          textBeforeParen = signatureText.substring(0, argsMatch.index!);
          const argsStr = argsMatch[1];
          if (argsStr.trim()) {
            argsStr.split(',').forEach(arg => {
              const parts = arg.trim().split(/\s+/);
              if (parts.length >= 2) {
                const argType = convertToType(parts[0]);
                const argName = parts[parts.length - 1]; // get the last part as name in case of extra spaces
                args.push({ [argName]: { type: argType, tooltip: '' } });
              }
            });
          }
        }

        const returnMatch = textBeforeParen.match(/(integer|float|string|key|vector|rotation|quaternion|quarternion|list)\s+/);
        if (returnMatch) {
          returnType = convertToType(returnMatch[1].trim());
        }

        let lineNum = scope.nameStartLine ?? scope.startLine;
        let colNum = lines[lineNum].indexOf(functionName);
        if (colNum === -1 && scope.nameStartLine !== scope.startLine && scope.startLine !== undefined) {
           lineNum = scope.startLine;
           colNum = lines[lineNum].indexOf(functionName);
        }

        userFunctions[functionName] = {
          arguments: args,
          energy: 0,
          'func-id': 0,
          return: returnType,
          sleep: 0,
          tooltip: '',
          categories: [],
          line: lineNum,
          column: Math.max(0, colNum)
        };
      }
    }
  });

  return userFunctions;
};

export const scanDocumentForVariables = (document: string): Variables => {
  const allVariables: { [key: string]: LSLVariable } = {};
  const commentedOutSections = getCommentedOutSections(document);
  const lines = document.split('\n');

  const allScopes = getScopes(document);
  let isInPreprocessorDefine = false;

  lines.forEach((line, lineNum) => {
    const quoteRanges = getQuoteRanges(line);

    let trimmedLine = line.trim();
    while (trimmedLine.includes('  ')) {
      trimmedLine = trimmedLine.replaceAll('  ', ' ');
    }
    if (isInPreprocessorDefine) {
      if (!trimmedLine.endsWith('\\')) {
        isInPreprocessorDefine = false;
      }
      return;
    }
    if (trimmedLine.startsWith('#define')) {
      const words = trimmedLine.split(' ');
      let name = words[1];
      if (words[1].includes('(')) {
        name = words[1].slice(0, words[1].indexOf('('));
      }
      allVariables[`${name}:${lineNum}`] = {
        name,
        type: LSLType.Unknown,
        line: lineNum,
        columnWithType: 0,
        column: line.search(new RegExp(`\\b${name}\\b`, 'gm')),
        references: [],
      };
      if (trimmedLine.endsWith('\\')) {
        isInPreprocessorDefine = true;
      }
      return;
    }

    // determine all defined variables
    const lineVariables = line.match(
      /(integer|float|key|string|vector|rotation|quarternion|list) +([a-zA-Z_][a-zA-Z0-9_]*)(?=[^(]*?[=;,)])/gm
    );
    if (lineVariables?.length) {
      lineVariables.forEach((match) => {
        const colNum = line.indexOf(match);
        if (
          commentedOutSections.isInSection(lineNum, colNum) ||
          quoteRanges.isInRange(colNum)
        )
          return;

        let trimmedMatch = match;
        while (trimmedMatch.includes('  '))
          trimmedMatch = trimmedMatch.replace('  ', ' ');
        const [type, name] = trimmedMatch.split(' ');
        allVariables[`${name}:${lineNum}`] = {
          name,
          type: convertToType(type),
          line: lineNum,
          columnWithType: colNum,
          column:
            line.slice(colNum).search(new RegExp(`\\b${name}\\b`, 'gm')) +
            colNum,
          references: [],
        };
      });
    }

    // look for references of existing variables
    Object.keys(allVariables).forEach((variableKey) => {
      const variable = allVariables[variableKey];
      const references = line.match(new RegExp(`\\b${variable.name}\\b`, 'gm'));
      if (references?.length) {
        references.forEach((_, refNum) => {
          let colNum = -1;
          for (let i = 0; i <= refNum; i++) {
            colNum =
              line
                .slice(colNum + 1)
                .search(new RegExp(`\\b${variable.name}\\b`, 'gm')) +
              colNum +
              1;
          }
          if (
            !commentedOutSections.isInSection(lineNum, colNum) &&
            !quoteRanges.isInRange(colNum) &&
            !(lineNum === variable.line && colNum === variable.column) &&
            allScopes.isInScope(
              { line: lineNum, character: colNum },
              { line: variable.line, character: variable.column }
            )
          ) {
            allVariables[variableKey].references.push({
              line: lineNum,
              character: colNum,
              isWrite:
                line
                  .slice(colNum)
                  .search(
                    new RegExp(`(?<=(?:\\+\\+|\\-\\-)) *(${variable.name})`)
                  ) === 0 ||
                line
                  .slice(colNum)
                  .search(
                    new RegExp(
                      `(${variable.name})(?= *(?:[+\\-*\\/%]=|\\+\\+|\\-\\-|=[^=]))`
                    )
                  ) === 0,
            });
          }
        });
      }
    });
  });

  return allVariables;
};

const allFunctions: { [key: string]: LSLFunction } = JSON.parse(
  fs.readFileSync(`${__dirname}/../../functions.json`, { encoding: 'utf8' })
);

export const scanDocumentForFunctionCalls = (document: string): LSLFunctionCall[] => {
  const functionCalls: LSLFunctionCall[] = [];
  const commentedOutSections = getCommentedOutSections(document);
  const lines = document.split('\n');

  lines.forEach((line, lineNum) => {
    const quoteRanges = getQuoteRanges(line);
    const functionCallMatches = line.matchAll(/[a-zA-Z_][a-zA-Z0-9_]*\s*(?=\()/gm);
    for (const match of functionCallMatches) {
      const colNum = match.index ?? -1;
      if (
        colNum === -1 ||
        commentedOutSections.isInSection(lineNum, colNum) ||
        quoteRanges.isInRange(colNum)
      ) {
        continue;
      }
      const functionName = match[0].trim();
      functionCalls.push({
        line: lineNum,
        character: colNum,
        functionName,
      });
    }
  });
  
  return functionCalls;
};
