export interface LogToken {
  text: string;
  type: 'text' | 'match' | 'timestamp' | 'component' | 'keyword-info' | 'keyword-warn' | 'keyword-error' | 'keyword-http';
}

export interface ParsedLogLine {
  isJson: boolean;
  jsonContent?: unknown;
  severity: 'error' | 'warn' | 'info';
  tokens: LogToken[];
}

export function parseLogLine(line: string, searchQuery: string = '', isRegex: boolean = false, disablePrettyJson: boolean = false): ParsedLogLine {
  const lower = line.toLowerCase();
  
  // 1. Determine Severity
  let severity: ParsedLogLine['severity'] = 'info';
  if (lower.includes('error') || lower.includes('critical') || lower.includes('fatal') || lower.includes('failed') || lower.includes('denied')) {
    severity = 'error';
  } else if (lower.includes('warn') || lower.includes('warning') || lower.includes('block') || lower.includes('conflict') || lower.includes('timeout') || lower.includes('retrying')) {
    severity = 'warn';
  }

  // 2. Try JSON
  if (!disablePrettyJson && line.trim().startsWith('{') && line.trim().endsWith('}')) {
    try {
      const jsonContent = JSON.parse(line);
      return {
        isJson: true,
        jsonContent,
        severity,
        tokens: [], // Not used for JSON view
      };
    } catch {
      // Not valid JSON
    }
  }

  // 3. Tokenize
  const query = searchQuery.trim();

  // Prepare Regex if applicable
  let searchRegex: RegExp | null = null;
  if (query) {
    if (isRegex) {
      try {
        searchRegex = new RegExp(query, 'gi');
      } catch {
        // Invalid regex, treat as no match or fallback to text?
        // For UI feedback it's better to just not match anything until valid
        searchRegex = null;
      }
    }
  }

  const highlightMatches = (text: string, type: LogToken['type']): LogToken[] => {
    if (!query) return [{ text, type }];
    
    const result: LogToken[] = [];
    let startIndex = 0;

    if (isRegex && searchRegex) {
        // REGEX MODE
        // We need to clone regex or reset lastIndex because it's stateful if 'g' flag is used
        searchRegex.lastIndex = 0;
        let match;
        while ((match = searchRegex.exec(text)) !== null) {
            if (match.index > startIndex) {
                result.push({ text: text.slice(startIndex, match.index), type });
            }
            result.push({ text: match[0], type: 'match' });
            startIndex = searchRegex.lastIndex;
            
            // Prevent infinite loops with zero-width matches
            if (match.index === searchRegex.lastIndex) {
                searchRegex.lastIndex++;
            }
        }
    } else if (!isRegex) {
        // PLAIN TEXT MODE
        const queryLower = query.toLowerCase();
        const lowerText = text.toLowerCase();
        let matchIndex = lowerText.indexOf(queryLower, startIndex);

        while (matchIndex !== -1) {
            if (matchIndex > startIndex) {
                result.push({ text: text.slice(startIndex, matchIndex), type });
            }
            result.push({ 
                text: text.slice(matchIndex, matchIndex + query.length), 
                type: 'match' 
            });
            startIndex = matchIndex + query.length;
            matchIndex = lowerText.indexOf(queryLower, startIndex);
        }
    }

    if (startIndex < text.length) {
      result.push({ text: text.slice(startIndex), type });
    }
    return result;
  };

  const parts = line.split(/(\[.*?\]|ERROR|WARN|WARNING|INFO|CRITICAL|FATAL|debug|Failed|failed|GET|POST|PUT|DELETE|Accepted|Started|Stopped|BLOCK|conflict|timeout|retrying|Reached|Listening|Created|Mounted|Connected)/gi);
  const tokens: LogToken[] = [];

  parts.forEach((part) => {
    if (!part) return;
    const lowerPart = part.toLowerCase();
    
    let type: LogToken['type'] = 'text';

    if (part.startsWith('[') && part.endsWith(']')) {
      type = 'timestamp'; // or component
    } else if (['info', 'started', 'reached', 'listening', 'created', 'mounted', 'accepted', 'connected'].includes(lowerPart)) {
      type = 'keyword-info';
    } else if (['warn', 'warning', 'block', 'conflict', 'timeout', 'retrying'].includes(lowerPart)) {
      type = 'keyword-warn';
    } else if (['error', 'critical', 'fatal', 'failed'].includes(lowerPart)) {
      type = 'keyword-error';
    } else if (['GET', 'POST', 'PUT', 'DELETE', 'Stopped'].includes(part)) { // Case sensitive check from original code? Original code used `includes(part)` on non-lowercased
      type = 'keyword-http';
    }

    tokens.push(...highlightMatches(part, type));
  });

  return {
    isJson: false,
    severity,
    tokens,
  };
}
