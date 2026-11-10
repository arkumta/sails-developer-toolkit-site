export type IDLEntry = {
  name: string;
  detail: string;
};

export type ParsedIDL = {
  version: string;
  warnings: string[];
  services: IDLEntry[];
  functions: IDLEntry[];
  constructors: IDLEntry[];
  types: IDLEntry[];
  events: IDLEntry[];
  programs: IDLEntry[];
  serviceIds: string[];
};

type Token = {
  value: string;
  line: number;
  column: number;
};

const BUILT_IN_TYPES = new Set([
  "bool",
  "char",
  "String",
  "str",
  "u8",
  "u16",
  "u32",
  "u64",
  "u128",
  "u256",
  "i8",
  "i16",
  "i32",
  "i64",
  "i128",
  "ActorId",
  "CodeId",
  "MessageId",
  "ProgramId",
  "H256",
  "H160",
  "H512",
  "U256",
  "U512",
  "Self",
]);

const GENERIC_TYPES = new Set([
  "Vec",
  "Option",
  "Result",
  "Box",
  "BTreeMap",
  "BTreeSet",
  "HashMap",
  "HashSet",
]);

function tokenize(source: string): Token[] {
  const tokens: Token[] = [];
  let i = 0;
  let line = 1;
  let column = 1;

  function advance(count = 1) {
    for (let n = 0; n < count; n++) {
      if (source[i] === "\n") {
        line++;
        column = 1;
      } else {
        column++;
      }
      i++;
    }
  }

  while (i < source.length) {
    const char = source[i];

    if (/\s/.test(char)) {
      advance();
      continue;
    }

    if (source.startsWith("//", i)) {
      while (i < source.length && source[i] !== "\n") {
        advance();
      }
      continue;
    }

    if (source.startsWith("/*", i)) {
      const startLine = line;
      const startColumn = column;
      advance(2);

      while (i < source.length && !source.startsWith("*/", i)) {
        advance();
      }

      if (i >= source.length) {
        throw new Error(
          `Line ${startLine}, column ${startColumn}: Unclosed block comment.`,
        );
      }

      advance(2);
      continue;
    }

    const tokenLine = line;
    const tokenColumn = column;

    if (source.startsWith("->", i)) {
      tokens.push({ value: "->", line, column });
      advance(2);
      continue;
    }

    if (source.startsWith("::", i)) {
      tokens.push({ value: "::", line, column });
      advance(2);
      continue;
    }

    if (/[A-Za-z0-9_]/.test(char)) {
      let value = "";

      while (i < source.length && /[A-Za-z0-9_]/.test(source[i])) {
        value += source[i];
        advance();
      }

      tokens.push({ value, line: tokenLine, column: tokenColumn });
      continue;
    }

    if ('{}()[]<>,;:@.!?=+-&'.includes(char)) {
      tokens.push({
        value: char,
        line: tokenLine,
        column: tokenColumn,
      });
      advance();
      continue;
    }

    if (char === '"' || char === "'") {
      const quote = char;
      let value = quote;
      advance();

      while (i < source.length && source[i] !== quote) {
        if (source[i] === "\\") {
          value += source[i];
          advance();

          if (i < source.length) {
            value += source[i];
            advance();
          }
        } else {
          value += source[i];
          advance();
        }
      }

      if (i >= source.length) {
        throw new Error(
          `Line ${tokenLine}, column ${tokenColumn}: Unclosed string.`,
        );
      }

      value += quote;
      advance();

      tokens.push({ value, line: tokenLine, column: tokenColumn });
      continue;
    }

    throw new Error(
      `Line ${line}, column ${column}: Unexpected character "${char}".`,
    );
  }

  return tokens;
}

function validateBrackets(tokens: Token[]) {
  const stack: Token[] = [];

  const pairs: Record<string, string> = {
    "}": "{",
    ")": "(",
    "]": "[",
  };

  for (const token of tokens) {
    if (["{", "(", "["].includes(token.value)) {
      stack.push(token);
    } else if (["}", ")", "]"].includes(token.value)) {
      const previous = stack.pop();

      if (!previous || previous.value !== pairs[token.value]) {
        throw new Error(
          `Line ${token.line}, column ${token.column}: Unexpected "${token.value}".`,
        );
      }
    }
  }

  if (stack.length > 0) {
    const token = stack[stack.length - 1];

    const expected =
      token.value === "{"
        ? "}"
        : token.value === "("
          ? ")"
          : "]";

    throw new Error(
      `Line ${token.line}, column ${token.column}: Missing closing "${expected}".`,
    );
  }
}

function matchingBrace(tokens: Token[], start: number): number {
  let depth = 0;

  for (let i = start; i < tokens.length; i++) {
    if (tokens[i].value === "{") depth++;
    if (tokens[i].value === "}") depth--;

    if (depth === 0) return i;
  }

  const token = tokens[start];

  throw new Error(
    `Line ${token.line}, column ${token.column}: Unclosed block.`,
  );
}

function getBlock(
  tokens: Token[],
  start: number,
  end: number,
  keyword: string,
): { open: number; close: number } | null {
  for (let i = start; i < end; i++) {
    if (tokens[i].value !== keyword) continue;

    let open = i + 1;

    while (open < end && tokens[open].value !== "{") {
      open++;
    }

    if (open >= end) {
      throw new Error(
        `Line ${tokens[i].line}, column ${tokens[i].column}: Expected a block after "${keyword}".`,
      );
    }

    const close = matchingBrace(tokens, open);

    if (close >= end) {
      throw new Error(
        `Line ${tokens[i].line}: "${keyword}" block exceeds its parent block.`,
      );
    }

    return { open, close };
  }

  return null;
}

function splitStatements(tokens: Token[]): Token[][] {
  const statements: Token[][] = [];
  let current: Token[] = [];
  let depth = 0;

  for (const token of tokens) {
    if (["{", "(", "[", "<"].includes(token.value)) {
      depth++;
    }

    if (["}", ")", "]", ">"].includes(token.value)) {
      depth--;
    }

    if (depth < 0) {
      throw new Error(
        `Line ${token.line}, column ${token.column}: Unexpected closing delimiter.`,
      );
    }

    if (token.value === ";" && depth === 0) {
      if (current.length === 0) {
        throw new Error(
          `Line ${token.line}, column ${token.column}: Empty declaration.`,
        );
      }

      statements.push(current);
      current = [];
    } else {
      current.push(token);
    }
  }

  if (depth !== 0) {
    const token = current[0] ?? tokens[tokens.length - 1];

    if (token) {
      throw new Error(
        `Line ${token.line}: Unclosed type or declaration.`,
      );
    }
  }

  if (current.length > 0) {
    const token = current[0];

    throw new Error(
      `Line ${token.line}, column ${token.column}: Missing semicolon at the end of declaration.`,
    );
  }

  return statements;
}

function tokenText(tokens: Token[]): string {
  let result = "";

  for (let i = 0; i < tokens.length; i++) {
    const current = tokens[i];
    const previous = tokens[i - 1];

    if (!previous) {
      result += current.value;
      continue;
    }

    const noSpaceBefore = [
      ",",
      ";",
      ")",
      "]",
      ">",
      "::",
    ];

    const noSpaceAfter = [
      "(",
      "[",
      "<",
      "::",
      "&",
    ];

    if (
      noSpaceBefore.includes(current.value) ||
      noSpaceAfter.includes(previous.value)
    ) {
      result += current.value;
    } else {
      result += ` ${current.value}`;
    }
  }

  return result;
}

function splitTopLevel(
  tokens: Token[],
  separator: string,
): Token[][] {
  const parts: Token[][] = [];
  let current: Token[] = [];
  let depth = 0;

  for (const token of tokens) {
    if (["(", "[", "<", "{"].includes(token.value)) {
      depth++;
    }

    if ([")", "]", ">", "}"].includes(token.value)) {
      depth--;
    }

    if (token.value === separator && depth === 0) {
      parts.push(current);
      current = [];
    } else {
      current.push(token);
    }
  }

  parts.push(current);
  return parts;
}

/**
 * Checks whether a type exists.
 *
 * Supports:
 * - Built-in types such as u128 and ActorId
 * - Declared custom types
 * - Vec<T>
 * - Option<T>
 * - Result<T, E>
 * - Tuple types such as (u32, String)
 * - Array types such as [u8; 32]
 */
function validateType(
  tokens: Token[],
  knownTypes: Set<string>,
  context: string,
) {
  if (tokens.length === 0) {
    throw new Error(`${context}: Missing type.`);
  }

  function fail(token: Token, message: string): never {
    throw new Error(
      `Line ${token.line}, column ${token.column}: ${context}: ${message}`,
    );
  }

  function validatePart(part: Token[]) {
    if (part.length === 0) {
      const token = tokens[0];
      fail(token, "Empty type declaration.");
    }

    // Reference types, if present.
    if (part[0].value === "&") {
      validatePart(part.slice(1));
      return;
    }

    // Tuple types: (u32, String)
    if (part[0].value === "(") {
      if (part[part.length - 1]?.value !== ")") {
        fail(part[0], "Invalid tuple type.");
      }

      const inside = part.slice(1, -1);

      if (inside.length === 0) return;

      for (const item of splitTopLevel(inside, ",")) {
        validatePart(item);
      }

      return;
    }

    // Array types: [u8; 32]
    if (part[0].value === "[") {
      if (part[part.length - 1]?.value !== "]") {
        fail(part[0], "Invalid array type.");
      }

      const inside = part.slice(1, -1);
      const sections = splitTopLevel(inside, ";");

      if (sections.length !== 2 || sections[1].length === 0) {
        fail(part[0], "Invalid array type. Expected [Type; Length].");
      }

      validatePart(sections[0]);

      if (!/^\d+$/.test(sections[1][0].value)) {
        fail(sections[1][0], "Array length must be a number.");
      }

      return;
    }

    const nameToken = part[0];
    const typeName = nameToken.value;

    if (!/^[A-Za-z_]\w*$/.test(typeName)) {
      fail(nameToken, `Invalid type name "${typeName}".`);
    }

    // Optional qualified names, for example module::Type.
    let cursor = 1;

    while (part[cursor]?.value === "::") {
      if (!part[cursor + 1]) {
        fail(part[cursor], "Incomplete qualified type name.");
      }

      cursor += 2;
    }

    const fullName = tokenText(part.slice(0, cursor)).replace(/\s/g, "");
    const isKnown =
      knownTypes.has(typeName) ||
      knownTypes.has(fullName) ||
      BUILT_IN_TYPES.has(typeName) ||
      GENERIC_TYPES.has(typeName);

    if (!isKnown) {
      fail(
        nameToken,
        `Unknown type "${typeName}". Declare this type inside a types block or use a supported built-in type.`,
      );
    }

    // Generic types: Vec<u32>, Option<Balance>, Result<String, u32>
    if (part[cursor]?.value === "<") {
      if (part[part.length - 1]?.value !== ">") {
        fail(part[cursor], `Invalid generic type "${typeName}".`);
      }

      const inner = part.slice(cursor + 1, -1);
      const argumentsList = splitTopLevel(inner, ",");

      if (argumentsList.some((argument) => argument.length === 0)) {
        fail(part[cursor], `Empty generic argument in "${typeName}".`);
      }

      if (typeName === "Vec" || typeName === "Option" || typeName === "Box") {
        if (argumentsList.length !== 1) {
          fail(nameToken, `${typeName} requires exactly one type argument.`);
        }
      }

      if (typeName === "Result" && argumentsList.length !== 2) {
        fail(nameToken, "Result requires two type arguments.");
      }

      for (const argument of argumentsList) {
        validatePart(argument);
      }

      return;
    }

    if (cursor !== part.length) {
      fail(
        part[cursor],
        `Unexpected token "${part[cursor].value}" in type "${typeName}".`,
      );
    }

    if (GENERIC_TYPES.has(typeName)) {
      fail(
        nameToken,
        `Generic type "${typeName}" requires type arguments.`,
      );
    }
  }

  validatePart(tokens);
}

function validateParameters(
  tokens: Token[],
  functionName: string,
  knownTypes: Set<string>,
) {
  if (tokens.length === 0) return;

  const parameters = splitTopLevel(tokens, ",");

  for (const parameter of parameters) {
    if (parameter.length === 0) {
      throw new Error(
        `Line ${tokens[0].line}: Function "${functionName}" contains an empty parameter.`,
      );
    }

    const first = parameter[0];

    if (!/^[A-Za-z_]\w*$/.test(first.value)) {
      throw new Error(
        `Line ${first.line}, column ${first.column}: Invalid parameter name in "${functionName}".`,
      );
    }

    if (parameter[1]?.value !== ":") {
      throw new Error(
        `Line ${first.line}, column ${first.column}: Parameter "${first.value}" requires a type annotation using ":". Example: ${first.value}: ActorId.`,
      );
    }

    const typeTokens = parameter.slice(2);

    if (typeTokens.length === 0) {
      throw new Error(
        `Line ${first.line}: Parameter "${first.value}" is missing its type.`,
      );
    }

    validateType(
      typeTokens,
      knownTypes,
      `Parameter "${first.value}" in function "${functionName}"`,
    );
  }
}

function parseFunctionStatement(
  statement: Token[],
  knownTypes: Set<string>,
): IDLEntry {
  let cursor = 0;
  let isQuery = false;
  let entryId: string | undefined;

  while (statement[cursor]?.value === "@") {
    const annotationToken = statement[cursor];
    cursor++;

    const annotationName = statement[cursor]?.value;

    if (!annotationName) {
      throw new Error(
        `Line ${annotationToken.line}: Invalid annotation.`,
      );
    }

    cursor++;

    if (annotationName === "query") {
      if (isQuery) {
        throw new Error(
          `Line ${annotationToken.line}: Duplicate @query annotation.`,
        );
      }

      isQuery = true;
      continue;
    }

    if (annotationName === "entry_id") {
      if (entryId !== undefined) {
        throw new Error(
          `Line ${annotationToken.line}: Duplicate @entry_id annotation.`,
        );
      }

      if (statement[cursor]?.value !== "(") {
        throw new Error(
          `Line ${annotationToken.line}: @entry_id requires a numeric value, for example @entry_id(10).`,
        );
      }

      cursor++;

      const argument = statement[cursor]?.value;

      if (!argument || !/^\d+$/.test(argument)) {
        throw new Error(
          `Line ${annotationToken.line}: Invalid @entry_id value. Use a non-negative integer.`,
        );
      }

      entryId = argument;
      cursor++;

      if (statement[cursor]?.value !== ")") {
        throw new Error(
          `Line ${annotationToken.line}: Invalid @entry_id annotation.`,
        );
      }

      cursor++;
      continue;
    }

    throw new Error(
      `Line ${annotationToken.line}: Unsupported annotation "@${annotationName}".`,
    );
  }

  const openParen = statement.findIndex(
    (token, index) => index >= cursor && token.value === "(",
  );

  if (openParen <= cursor) {
    const token = statement[cursor] ?? statement[0];

    throw new Error(
      `Line ${token.line}: Expected a function name followed by parameters.`,
    );
  }

  if (openParen !== cursor + 1) {
    throw new Error(
      `Line ${statement[cursor].line}: Invalid function declaration.`,
    );
  }

  const nameToken = statement[cursor];
  const functionName = nameToken.value;

  if (!/^[A-Za-z_]\w*$/.test(functionName)) {
    throw new Error(
      `Line ${nameToken.line}: Invalid function name.`,
    );
  }

  let depth = 0;
  let closeParen = -1;

  for (let i = openParen; i < statement.length; i++) {
    if (statement[i].value === "(") depth++;
    if (statement[i].value === ")") depth--;

    if (depth === 0) {
      closeParen = i;
      break;
    }
  }

  if (closeParen < 0) {
    throw new Error(
      `Line ${nameToken.line}: Missing closing ")" in function "${functionName}".`,
    );
  }

  const parameterTokens = statement.slice(openParen + 1, closeParen);

  validateParameters(
    parameterTokens,
    functionName,
    knownTypes,
  );

  const outputIndex = closeParen + 1;

  if (statement[outputIndex]?.value !== "->") {
    const token = statement[outputIndex] ?? statement[closeParen];

    throw new Error(
      `Line ${token.line}: Function "${functionName}" is missing "->" before its return type.`,
    );
  }

  const returnTokens = statement.slice(outputIndex + 1);

  if (returnTokens.length === 0) {
    throw new Error(
      `Line ${statement[outputIndex].line}: Function "${functionName}" is missing its return type.`,
    );
  }

  validateType(
    returnTokens,
    knownTypes,
    `Return type of function "${functionName}"`,
  );

  const params = tokenText(parameterTokens);
  const output = tokenText(returnTokens);

  const details: string[] = [`(${params}) → ${output}`];

  if (isQuery) details.push("Query");
  if (entryId !== undefined) details.push(`Entry ID: ${entryId}`);

  return {
    name: functionName,
    detail: details.join(" · "),
  };
}

function collectCustomTypes(
  tokens: Token[],
  knownTypes: Set<string>,
  result: IDLEntry[],
) {
  for (let i = 0; i < tokens.length - 1; i++) {
    const keyword = tokens[i].value;

    if (!["struct", "enum", "type"].includes(keyword)) {
      continue;
    }

    const nameToken = tokens[i + 1];

    if (!nameToken || !/^[A-Za-z_]\w*$/.test(nameToken.value)) {
      throw new Error(
        `Line ${tokens[i].line}: Invalid custom type declaration.`,
      );
    }

    if (result.some((item) => item.name === nameToken.value)) {
      throw new Error(
        `Line ${nameToken.line}: Duplicate custom type "${nameToken.value}".`,
      );
    }

    knownTypes.add(nameToken.value);

    result.push({
      name: nameToken.value,
      detail: `Custom ${keyword} declaration`,
    });
  }
}

export function parseSailsIDL(source: string): ParsedIDL {
  const headerMatch = source.match(
    /^\s*!@sails:\s*(\d+\.\d+\.\d+)\s*$/m,
  );

  if (!headerMatch) {
    throw new Error(
      "Invalid Sails IDL header. Expected a version such as !@sails: 2.0.0.",
    );
  }

  const version = headerMatch[1];
  const warnings: string[] = [];

  if (version !== "2.0.0") {
    warnings.push(
      `Sails ${version} has not been tested with this parser. Results may be incomplete.`,
    );
  }

  // Preserve line positions when removing the Sails directive.
  const declarationSource = source.replace(
    /^\s*!@sails:.*$/m,
    (line) => line.replace(/[^\n]/g, " "),
  );

  const tokens = tokenize(declarationSource);

  if (tokens.length === 0) {
    throw new Error("The IDL file contains no declarations.");
  }

  validateBrackets(tokens);

  const result: ParsedIDL = {
    version,
    warnings,
    services: [],
    functions: [],
    constructors: [],
    types: [],
    events: [],
    programs: [],
    serviceIds: [],
  };

  const knownTypes = new Set<string>([
    ...BUILT_IN_TYPES,
    ...GENERIC_TYPES,
  ]);

  // First pass: collect custom types before checking function signatures.
  for (let i = 0; i < tokens.length; i++) {
    if (tokens[i].value !== "service") continue;

    const serviceOpen = tokens.findIndex(
      (token, index) => index > i && token.value === "{",
    );

    if (serviceOpen < 0) continue;

    const serviceClose = matchingBrace(tokens, serviceOpen);
    const body = tokens.slice(serviceOpen + 1, serviceClose);
    const typesBlock = getBlock(body, 0, body.length, "types");

    if (typesBlock) {
      collectCustomTypes(
        body.slice(typesBlock.open + 1, typesBlock.close),
        knownTypes,
        result.types,
      );
    }

    i = serviceClose;
  }

  let foundDeclaration = false;

  for (let i = 0; i < tokens.length; i++) {
    const token = tokens[i];

    if (token.value !== "service" && token.value !== "program") {
      continue;
    }

    const kind = token.value;
    const nameToken = tokens[i + 1];

    if (!nameToken || !/^[A-Za-z_]\w*$/.test(nameToken.value)) {
      throw new Error(
        `Line ${token.line}, column ${token.column}: Expected a ${kind} name.`,
      );
    }

    const name = nameToken.value;
    let cursor = i + 2;
    let serviceId = "";

    if (kind === "service" && tokens[cursor]?.value === "@") {
      serviceId = tokens[cursor + 1]?.value ?? "";

      if (!/^0x[0-9a-fA-F]+$/.test(serviceId)) {
        throw new Error(
          `Line ${tokens[cursor].line}: Invalid service ID.`,
        );
      }

      cursor += 2;
    }

    while (cursor < tokens.length && tokens[cursor].value !== "{") {
      cursor++;
    }

    if (cursor >= tokens.length) {
      throw new Error(
        `Line ${token.line}: Missing block for ${kind} "${name}".`,
      );
    }

    const close = matchingBrace(tokens, cursor);
    const body = tokens.slice(cursor + 1, close);

    foundDeclaration = true;

    if (kind === "service") {
      if (result.services.some((item) => item.name === name)) {
        throw new Error(
          `Line ${token.line}: Duplicate service "${name}".`,
        );
      }

      result.services.push({
        name,
        detail: serviceId
          ? `Service ID: ${serviceId}`
          : "Service declaration",
      });

      if (serviceId) {
        result.serviceIds.push(serviceId);
      }

      const functionsBlock = getBlock(
        body,
        0,
        body.length,
        "functions",
      );

      if (functionsBlock) {
        const statements = splitStatements(
          body.slice(
            functionsBlock.open + 1,
            functionsBlock.close,
          ),
        );

        const functionNames = new Set<string>();

        for (const statement of statements) {
          const parsedFunction = parseFunctionStatement(
            statement,
            knownTypes,
          );

          if (functionNames.has(parsedFunction.name)) {
            throw new Error(
              `Line ${statement[0].line}: Duplicate function "${parsedFunction.name}" in service "${name}".`,
            );
          }

          functionNames.add(parsedFunction.name);
          result.functions.push(parsedFunction);
        }
      }

      const constructorsBlock = getBlock(
        body,
        0,
        body.length,
        "constructors",
      );

      if (constructorsBlock) {
        const statements = splitStatements(
          body.slice(
            constructorsBlock.open + 1,
            constructorsBlock.close,
          ),
        );

        for (const statement of statements) {
          const openParen = statement.findIndex(
            (item) => item.value === "(",
          );

          if (openParen <= 0) {
            throw new Error(
              `Line ${statement[0].line}: Invalid constructor declaration.`,
            );
          }

          result.constructors.push({
            name: statement[openParen - 1].value,
            detail: `(${tokenText(statement.slice(openParen + 1, -1))})`,
          });
        }
      }

      const typesBlock = getBlock(
        body,
        0,
        body.length,
        "types",
      );



      const eventsBlock = getBlock(
        body,
        0,
        body.length,
        "events",
      );

      if (eventsBlock) {
        const eventTokens = body.slice(
          eventsBlock.open + 1,
          eventsBlock.close,
        );

        for (let j = 0; j < eventTokens.length - 1; j++) {
          if (
            /^[A-Za-z_]\w*$/.test(eventTokens[j].value) &&
            eventTokens[j + 1].value === "{"
          ) {
            result.events.push({
              name: eventTokens[j].value,
              detail: "Event declaration",
            });
          }
        }
      }
    }

    if (kind === "program") {
      result.programs.push({
        name,
        detail: "Program declaration",
      });

      const constructorsBlock = getBlock(
        body,
        0,
        body.length,
        "constructors",
      );

      if (constructorsBlock) {
        const statements = splitStatements(
          body.slice(
            constructorsBlock.open + 1,
            constructorsBlock.close,
          ),
        );

        for (const statement of statements) {
          const openParen = statement.findIndex(
            (item) => item.value === "(",
          );

          if (openParen <= 0) {
            throw new Error(
              `Line ${statement[0].line}: Invalid constructor declaration.`,
            );
          }

          result.constructors.push({
            name: statement[openParen - 1].value,
            detail: `(${tokenText(statement.slice(openParen + 1, -1))})`,
          });
        }
      }

      const servicesBlock = getBlock(
        body,
        0,
        body.length,
        "services",
      );

      if (servicesBlock) {
        const statements = splitStatements(
          body.slice(
            servicesBlock.open + 1,
            servicesBlock.close,
          ),
        );

        for (const statement of statements) {
          const serviceIndex = statement.findIndex(
            (item) => item.value === "@",
          );

          if (serviceIndex >= 0) {
            const id = statement[serviceIndex + 1]?.value;

            if (id && /^0x[0-9a-fA-F]+$/.test(id)) {
              if (!result.serviceIds.includes(id)) {
                result.serviceIds.push(id);
              }
            }
          }
        }
      }
    }

    i = close;
  }

  if (!foundDeclaration) {
    throw new Error(
      "No service or program declarations were found.",
    );
  }

  return result;
}