import { Position } from 'vscode-languageserver';
import getCommentedOutSections from './comments';
import getQuoteRanges from './quoteRanges';

type Scopes = {
  scopes: Scope[];
  isInScope: (
    referencePosition: Position,
    definitionPosition: Position
  ) => boolean;
};

// colNumber is inclusive on start and exclusive on end
type Scope = {
  parentIndex: number;
  startLine: number;
  startCol: number;
  endLine?: number;
  endCol?: number;
  name?: string;
  nameStartLine?: number;
  nameStartCol?: number;
};

const positionToScopeId =
  (scopes: Scope[]) =>
  ({ line, character }: Position): number => {
    let result = -1;
    scopes.forEach(({ startLine, startCol, endLine, endCol }, index) => {
      if (
        (line > startLine || (line === startLine && character >= startCol)) &&
        (line < endLine! || (line === endLine && character < endCol!))
      )
        result = index;
    });

    return result;
  };

const isReferenceInScopeOfDefinition =
  (scopes: Scope[]) =>
  (referencePosition: Position, definitionPosition: Position) => {
    const getScopeId = positionToScopeId(scopes);
    const definitionScopeId = getScopeId(definitionPosition);
    const referenceScopeId = getScopeId(referencePosition);
    let currentScopeId = referenceScopeId;

    while (currentScopeId !== -1) {
      if (
        currentScopeId === definitionScopeId &&
        (referencePosition.line > definitionPosition.line ||
          (referencePosition.line === definitionPosition.line &&
            referencePosition.character > definitionPosition.character))
      )
        return true;
      currentScopeId = scopes[currentScopeId].parentIndex;
    }
    return false;
  };

const getScopes = (document: string): Scopes => {
  const scopes: Scope[] = [
    {
      parentIndex: -1,
      startLine: 0,
      startCol: 0,
      endLine: document.split('\n').length + 1,
      endCol: 0,
    },
  ];

  const commentedOutSections = getCommentedOutSections(document);
  const lines = document.split('\n');

  let currentScopeIndex = 0;

  // Step 1: determine where the curly braces are, note down line number and column number
  let lastNonEmptyLine = '';
  let lastNonEmptyScopeNameStart = 0;
  let lastNonEmptyLineNum = 0;
  let parenLevel = 0;

  lines.forEach((line, lineNum) => {
    let currentLine = '';
    let scopeNameStart = 0;
    const quoteRanges = getQuoteRanges(line);
    line.split('').forEach((char, colNum) => {
      if (
        !quoteRanges.isInRange(colNum) &&
        !commentedOutSections.isInSection(lineNum, colNum)
      ) {
        if (char === '{') {
          const hasCurrentLineName = !!currentLine.trim();
          scopes.push({
            parentIndex: currentScopeIndex,
            startLine: lineNum,
            startCol: colNum,
            name: hasCurrentLineName ? currentLine.trim() : lastNonEmptyLine.trim(),
            nameStartLine: hasCurrentLineName ? lineNum : lastNonEmptyLineNum,
            nameStartCol: hasCurrentLineName
              ? scopeNameStart
              : lastNonEmptyScopeNameStart,
          });
          currentLine = '';
          scopeNameStart = colNum + 1;
          currentScopeIndex = scopes.length - 1;
          lastNonEmptyLine = '';
        } else if (char === '}') {
          currentLine = '';
          scopeNameStart = colNum + 1;
          if (scopes[currentScopeIndex]) {
            scopes[currentScopeIndex].endLine = lineNum;
            scopes[currentScopeIndex].endCol = colNum;
            currentScopeIndex = scopes[currentScopeIndex].parentIndex;
          }
          lastNonEmptyLine = '';
        } else if ('()'.includes(char)) {
          parenLevel = Math.max(0, parenLevel + (char === '(' ? 1 : -1));
        } else if (char === ';' && parenLevel === 0) {
          currentLine = '';
          scopeNameStart = colNum + 1;
          lastNonEmptyLine = '';
        } else if (char.match(/[A-Za-z0-9_ #]/) && parenLevel === 0) {
          if (!currentLine.trim()) {
            scopeNameStart = colNum;
          }
          currentLine += char;

          if (
            [
              'integer ',
              'float ',
              'string ',
              'key ',
              'list ',
              'vector ',
              'rotation ',
              'quaternion ',
            ].includes(currentLine)
          ) {
            currentLine = '';
            scopeNameStart = colNum + 1;
          }
        }
      }
    });
    if (currentLine.trim()) {
      lastNonEmptyLine = currentLine;
      lastNonEmptyScopeNameStart = scopeNameStart;
      lastNonEmptyLineNum = lineNum;
    }
  });

  return {
    scopes,
    isInScope: isReferenceInScopeOfDefinition(scopes),
  };
};

export default getScopes;
