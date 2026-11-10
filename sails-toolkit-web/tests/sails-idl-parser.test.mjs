import test from "node:test";
import assert from "node:assert/strict";
import { parseSailsIDL } from "../app/lib/sails-idl-parser.ts";

const validIDL = `!@sails: 2.0.0

service TokenService {
  functions {
    @query
    GetBalance(account: ActorId) -> u128;

    @entry_id(10)
    Transfer(to: ActorId, amount: u128) -> bool;
  }

  types {
    struct Balance {
      amount: u128,
      owner: ActorId,
    }
  }
}`;

test("valid IDL parses services, functions and custom types", () => {
  const result = parseSailsIDL(validIDL);
  assert.equal(result.services.length, 1);
  assert.equal(result.functions.length, 2);
  assert.equal(result.types.length, 1);
});

test("missing Sails header is rejected", () => {
  assert.throws(() => parseSailsIDL(
    "service TestService { }"
  ), /header/i);
});

test("unsupported Sails version produces a warning", () => {
  const result = parseSailsIDL(
    validIDL.replace("2.0.0", "99.99.99")
  );
  assert.ok(result.warnings.length > 0);
});

test("unclosed service block is rejected", () => {
  assert.throws(() => parseSailsIDL(
    "!@sails: 2.0.0\nservice TestService {\n"
  ), /closing|unclosed/i);
});

test("missing function semicolon is rejected", () => {
  assert.throws(() => parseSailsIDL(
    `!@sails: 2.0.0
service TestService {
  functions {
    GetBalance(account: ActorId) -> u128
  }
}`
  ), /semicolon/i);
});

test("function parameter without type is rejected", () => {
  assert.throws(() => parseSailsIDL(
    `!@sails: 2.0.0
service TestService {
  functions {
    GetBalance(account ActorId) -> u128;
  }
}`
  ), /type annotation/i);
});

test("unknown custom type is rejected", () => {
  assert.throws(() => parseSailsIDL(
    `!@sails: 2.0.0
service TestService {
  functions {
    GetBalance(account: UnknownType) -> u128;
  }
}`
  ), /Unknown type/i);
});

test("empty IDL declarations are rejected", () => {
  assert.throws(() => parseSailsIDL(
    "!@sails: 2.0.0"
  ), /no declarations/i);
});

test("Option with a built-in type is accepted", () => {
  const result = parseSailsIDL(`!@sails: 2.0.0
service TestService {
  functions {
    GetBalance(account: ActorId) -> Option<u128>;
  }
}`);
  assert.equal(result.functions.length, 1);
});

test("Vec with a built-in type is accepted", () => {
  const result = parseSailsIDL(`!@sails: 2.0.0
service TestService {
  functions {
    GetBalances() -> Vec<u32>;
  }
}`);
  assert.equal(result.functions.length, 1);
});

test("Result with two built-in types is accepted", () => {
  const result = parseSailsIDL(`!@sails: 2.0.0
service TestService {
  functions {
    GetValue() -> Result<String, u32>;
  }
}`);
  assert.equal(result.functions.length, 1);
});

test("unknown return type is rejected", () => {
  assert.throws(() => parseSailsIDL(`!@sails: 2.0.0
service TestService {
  functions {
    GetValue() -> UnknownReturnType;
  }
}`), /Unknown type/i);
});

test("nested Option and Vec types are accepted", () => {
  const result = parseSailsIDL(`!@sails: 2.0.0
service TestService {
  functions {
    GetValues() -> Option<Vec<u32>>;
  }
}`);
  assert.equal(result.functions.length, 1);
});

test("unknown nested generic type is rejected", () => {
  assert.throws(() => parseSailsIDL(`!@sails: 2.0.0
service TestService {
  functions {
    GetValues() -> Vec<UnknownType>;
  }
}`), /Unknown type/i);
});

test("duplicate service names are rejected", () => {
  const source = `
!@sails: 2.0.0

service DuplicateService {
}

service DuplicateService {
}
`;

  assert.throws(
    () => parseSailsIDL(source),
    /Duplicate service "DuplicateService"/
  );
});

test("custom type can be used in a function signature", () => {
  const result = parseSailsIDL(`!@sails: 2.0.0
service TestService {
  functions {
    GetBalance(account: Balance) -> Option<Balance>;
  }
  types {
    struct Balance {
      amount: u128,
    }
  }
}`);
  assert.equal(result.types.length, 1);
  assert.equal(result.functions.length, 1);
});

test("duplicate custom type names are rejected", () => {
  const source = `
!@sails: 2.0.0

service MyService {
  types {
    struct Balance {
      amount: u128,
    }

    struct Balance {
      amount: u64,
    }
  }
}
`;

  assert.throws(
    () => parseSailsIDL(source),
    /Duplicate custom type "Balance"/
  );
});

test("duplicate function names within a service are rejected", () => {
  const source = `
!@sails: 2.0.0

service MyService {
  functions {
    GetBalance(account: ActorId) -> u128;
    GetBalance(account: ActorId) -> u64;
  }
}
`;

  assert.throws(
    () => parseSailsIDL(source),
    /Duplicate function "GetBalance" in service "MyService"/
  );
});

