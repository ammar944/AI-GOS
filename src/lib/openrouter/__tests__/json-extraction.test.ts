import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { OpenRouterClient } from "../client";

// =============================================================================
// Testable Client - Exposes protected methods for testing
// =============================================================================

/**
 * TestableOpenRouterClient exposes protected methods for testing.
 * This pattern allows testing private logic without modifying production code
 * (only changing private -> protected which is minimal).
 */
class TestableOpenRouterClient extends OpenRouterClient {
  constructor() {
    super("test-api-key");
  }

  // Expose protected methods for testing
  public testExtractJSON(content: string): string | null {
    return this.extractJSON(content);
  }

  public testExtractBalancedJSON(
    content: string,
    openChar: string,
    closeChar: string
  ): string | null {
    return this.extractBalancedJSON(content, openChar, closeChar);
  }

  public testIsValidJSON(str: string): boolean {
    return this.isValidJSON(str);
  }

  public testRepairJSON(json: string): string {
    return this.repairJSON(json);
  }
}

describe("json-extraction.test.ts", () => {
  let client: TestableOpenRouterClient;

  beforeEach(() => {
    client = new TestableOpenRouterClient();
    // Silence console.log for extraction strategy messages
    vi.spyOn(console, "log").mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // ===========================================================================
  // Strategy 1: Direct Parse
  // ===========================================================================

  describe("Strategy 1: Direct parse", () => {
    it("parses valid JSON object directly", () => {
      // Arrange
      const input = '{"key": "value"}';

      // Act
      const result = client.testExtractJSON(input);

      // Assert
      expect(result).toBe('{"key": "value"}');
    });

    it("parses valid JSON array directly", () => {
      // Arrange
      const input = "[1, 2, 3]";

      // Act
      const result = client.testExtractJSON(input);

      // Assert
      expect(result).toBe("[1, 2, 3]");
    });

    it("parses empty object", () => {
      // Arrange
      const input = "{}";

      // Act
      const result = client.testExtractJSON(input);

      // Assert
      expect(result).toBe("{}");
    });

    it("parses empty array", () => {
      // Arrange
      const input = "[]";

      // Act
      const result = client.testExtractJSON(input);

      // Assert
      expect(result).toBe("[]");
    });

    it("parses nested structures", () => {
      // Arrange
      const input = '{"outer": {"inner": [1, 2, {"nested": true}]}}';

      // Act
      const result = client.testExtractJSON(input);

      // Assert
      expect(result).toBe('{"outer": {"inner": [1, 2, {"nested": true}]}}');
    });

    it("returns null for primitive number", () => {
      // Arrange
      const input = "42";

      // Act
      const result = client.testExtractJSON(input);

      // Assert
      expect(result).toBeNull();
    });

    it("returns null for primitive string", () => {
      // Arrange
      const input = '"hello"';

      // Act
      const result = client.testExtractJSON(input);

      // Assert
      expect(result).toBeNull();
    });

    it("returns null for primitive boolean", () => {
      // Arrange
      const input = "true";

      // Act
      const result = client.testExtractJSON(input);

      // Assert
      expect(result).toBeNull();
    });

    it("returns null for primitive null", () => {
      // Arrange
      const input = "null";

      // Act
      const result = client.testExtractJSON(input);

      // Assert
      expect(result).toBeNull();
    });

    it("trims whitespace before parsing", () => {
      // Arrange
      const input = '   {"key": "value"}   ';

      // Act
      const result = client.testExtractJSON(input);

      // Assert
      expect(result).toBe('{"key": "value"}');
    });

    it.each([
      ['{"a": 1, "b": 2}', '{"a": 1, "b": 2}'],
      ['[{"x": 1}, {"y": 2}]', '[{"x": 1}, {"y": 2}]'],
      ['{"arr": [1, 2, 3], "obj": {"nested": true}}', '{"arr": [1, 2, 3], "obj": {"nested": true}}'],
    ])("parses complex structure: %s", (input, expected) => {
      const result = client.testExtractJSON(input);
      expect(result).toBe(expected);
    });
  });

  // ===========================================================================
  // Strategy 2: Balanced Object Extraction
  // ===========================================================================

  describe("Strategy 2: Balanced object extraction", () => {
    it("extracts JSON object with trailing text", () => {
      // Arrange
      const input = '{"a": 1} some extra text';

      // Act
      const result = client.testExtractJSON(input);

      // Assert
      expect(result).toBe('{"a": 1}');
    });

    it("extracts JSON object with leading whitespace", () => {
      // Arrange
      const input = '   {"a": 1}';

      // Act
      const result = client.testExtractJSON(input);

      // Assert
      expect(result).toBe('{"a": 1}');
    });

    it("handles nested objects correctly", () => {
      // Arrange
      const input = '{"outer": {"inner": {"deep": 1}}} trailing';

      // Act
      const result = client.testExtractJSON(input);

      // Assert
      expect(result).toBe('{"outer": {"inner": {"deep": 1}}}');
    });

    it("handles escaped quotes in strings", () => {
      // Arrange
      const input = '{"text": "He said \\"hello\\""} extra';

      // Act
      const result = client.testExtractJSON(input);

      // Assert
      expect(result).toBe('{"text": "He said \\"hello\\""}');
    });

    it("handles strings containing braces", () => {
      // Arrange
      const input = '{"code": "function() { return {}; }"} after';

      // Act
      const result = client.testExtractJSON(input);

      // Assert
      expect(result).toBe('{"code": "function() { return {}; }"}');
    });

    it("handles multiple trailing sentences", () => {
      // Arrange
      const input = '{"result": true} Here is the explanation. It worked well.';

      // Act
      const result = client.testExtractJSON(input);

      // Assert
      expect(result).toBe('{"result": true}');
    });
  });

  // ===========================================================================
  // Strategy 3: Balanced Array Extraction
  // ===========================================================================

  describe("Strategy 3: Balanced array extraction", () => {
    it("extracts array with trailing text", () => {
      // Arrange
      const input = "[1, 2, 3] extra";

      // Act
      const result = client.testExtractJSON(input);

      // Assert
      expect(result).toBe("[1, 2, 3]");
    });

    it("handles nested arrays", () => {
      // Arrange
      const input = "[[1, 2], [3, 4]] trailing text";

      // Act
      const result = client.testExtractJSON(input);

      // Assert
      expect(result).toBe("[[1, 2], [3, 4]]");
    });

    it("handles mixed arrays with objects", () => {
      // Arrange
      const input = '[{"a": 1}, {"b": 2}] extra';

      // Act
      const result = client.testExtractJSON(input);

      // Assert
      expect(result).toBe('[{"a": 1}, {"b": 2}]');
    });

    it("handles arrays with strings containing brackets", () => {
      // Arrange
      const input = '["a[1]", "b[2]"] trailing';

      // Act
      const result = client.testExtractJSON(input);

      // Assert
      expect(result).toBe('["a[1]", "b[2]"]');
    });

    it("handles deeply nested mixed structures", () => {
      // Arrange
      const input = '[{"arr": [1, [2, 3]]}, {"obj": {"nested": []}}] end';

      // Act
      const result = client.testExtractJSON(input);

      // Assert
      expect(result).toBe('[{"arr": [1, [2, 3]]}, {"obj": {"nested": []}}]');
    });
  });

  // ===========================================================================
  // Strategy 4: Markdown Code Blocks
  // ===========================================================================

  describe("Strategy 4: Markdown code blocks", () => {
    it("extracts JSON from code block with json tag", () => {
      // Arrange
      const input = '```json\n{"a": 1}\n```';

      // Act
      const result = client.testExtractJSON(input);

      // Assert
      expect(result).toBe('{"a": 1}');
    });

    it("extracts JSON from code block without language tag", () => {
      // Arrange
      const input = '```\n{"a": 1}\n```';

      // Act
      const result = client.testExtractJSON(input);

      // Assert
      expect(result).toBe('{"a": 1}');
    });

    it("handles code block with extra whitespace", () => {
      // Arrange
      const input = '```json\n  {"a": 1}  \n```';

      // Act
      const result = client.testExtractJSON(input);

      // Assert
      expect(result).toBe('{"a": 1}');
    });

    it("extracts array from code block", () => {
      // Arrange
      const input = '```json\n[1, 2, 3]\n```';

      // Act
      const result = client.testExtractJSON(input);

      // Assert
      expect(result).toBe("[1, 2, 3]");
    });

    it("handles code block with surrounding text", () => {
      // Arrange
      const input = 'Here is the result:\n```json\n{"result": "success"}\n```\nEnd of response.';

      // Act
      const result = client.testExtractJSON(input);

      // Assert
      expect(result).toBe('{"result": "success"}');
    });

    it("handles code block with complex nested JSON", () => {
      // Arrange
      const input = '```json\n{"data": {"items": [{"id": 1}, {"id": 2}]}}\n```';

      // Act
      const result = client.testExtractJSON(input);

      // Assert
      expect(result).toBe('{"data": {"items": [{"id": 1}, {"id": 2}]}}');
    });

    it("extracts from code block with unbalanced JSON (uses balanced extraction)", () => {
      // Arrange - code block has JSON with extra text after
      const input = '```json\n{"a": 1} extra text inside block\n```';

      // Act
      const result = client.testExtractJSON(input);

      // Assert
      expect(result).toBe('{"a": 1}');
    });
  });

  // ===========================================================================
  // Strategy 5: Find First Brace
  // ===========================================================================

  describe("Strategy 5: Find first brace", () => {
    it("extracts JSON after text", () => {
      // Arrange
      const input = 'Here is the data: {"key": "value"}';

      // Act
      const result = client.testExtractJSON(input);

      // Assert
      expect(result).toBe('{"key": "value"}');
    });

    it("extracts JSON in middle of text", () => {
      // Arrange
      const input = 'Start {"middle": true} end';

      // Act
      const result = client.testExtractJSON(input);

      // Assert
      expect(result).toBe('{"middle": true}');
    });

    it("handles multiple braces - finds outermost balanced", () => {
      // Arrange
      const input = 'Text {"a": {"b": 1}} more text';

      // Act
      const result = client.testExtractJSON(input);

      // Assert
      expect(result).toBe('{"a": {"b": 1}}');
    });

    it("handles JSON after newlines", () => {
      // Arrange
      const input = 'Introduction:\n\n{"result": "success"}';

      // Act
      const result = client.testExtractJSON(input);

      // Assert
      expect(result).toBe('{"result": "success"}');
    });

    it("extracts first valid JSON object when multiple exist", () => {
      // Arrange
      const input = 'Text {"first": 1} more {"second": 2}';

      // Act
      const result = client.testExtractJSON(input);

      // Assert
      expect(result).toBe('{"first": 1}');
    });
  });

  // ===========================================================================
  // Strategy 6: Find First Bracket
  // ===========================================================================

  describe("Strategy 6: Find first bracket", () => {
    it("extracts array after text", () => {
      // Arrange
      const input = "Results: [1, 2, 3]";

      // Act
      const result = client.testExtractJSON(input);

      // Assert
      expect(result).toBe("[1, 2, 3]");
    });

    it("extracts array in middle of text", () => {
      // Arrange
      const input = "Start [1, 2] end";

      // Act
      const result = client.testExtractJSON(input);

      // Assert
      expect(result).toBe("[1, 2]");
    });

    it("handles nested arrays with preceding text", () => {
      // Arrange
      const input = "Data: [[1, 2], [3, 4]] done";

      // Act
      const result = client.testExtractJSON(input);

      // Assert
      expect(result).toBe("[[1, 2], [3, 4]]");
    });

    it("prefers object when brace comes before bracket", () => {
      // Arrange - { comes before [
      const input = 'Data {"a": 1} then [1, 2]';

      // Act
      const result = client.testExtractJSON(input);

      // Assert
      expect(result).toBe('{"a": 1}');
    });

    it("finds brace before bracket (strategy 5 runs before strategy 6)", () => {
      // Arrange - [ comes before { but strategy 5 (find-first-brace) runs before strategy 6
      // This is the actual behavior - strategies are tried in order, not by position
      const input = 'Data [1, 2] then {"a": 1}';

      // Act
      const result = client.testExtractJSON(input);

      // Assert - Strategy 5 finds the object even though array appears first in text
      expect(result).toBe('{"a": 1}');
    });

    it("extracts array when no brace exists", () => {
      // Arrange - only array present, no objects
      const input = "Data [1, 2, 3] end of text";

      // Act
      const result = client.testExtractJSON(input);

      // Assert
      expect(result).toBe("[1, 2, 3]");
    });
  });

  // ===========================================================================
  // Strategy 7: Repair on Unbalanced
  // ===========================================================================

  describe("Strategy 7: Repair on unbalanced", () => {
    it("repairs truncated object - missing closing brace", () => {
      // Arrange
      const input = '{"a": 1, "b": 2';

      // Act
      const result = client.testExtractJSON(input);

      // Assert
      expect(result).not.toBeNull();
      const parsed = JSON.parse(result!);
      expect(parsed.a).toBe(1);
      expect(parsed.b).toBe(2);
    });

    it("repairs truncated array - missing closing bracket", () => {
      // Arrange
      const input = "[1, 2, 3";

      // Act
      const result = client.testExtractJSON(input);

      // Assert
      expect(result).not.toBeNull();
      const parsed = JSON.parse(result!);
      expect(parsed).toEqual([1, 2, 3]);
    });

    it("repairs multiple levels of nesting truncated", () => {
      // Arrange
      const input = '{"outer": {"inner": [1, 2';

      // Act
      const result = client.testExtractJSON(input);

      // Assert
      expect(result).not.toBeNull();
      const parsed = JSON.parse(result!);
      expect(parsed.outer.inner).toEqual([1, 2]);
    });

    it("repairs object with text before", () => {
      // Arrange
      const input = 'Response: {"data": [1, 2';

      // Act
      const result = client.testExtractJSON(input);

      // Assert
      expect(result).not.toBeNull();
      const parsed = JSON.parse(result!);
      expect(parsed.data).toEqual([1, 2]);
    });
  });

  // ===========================================================================
  // Strategy 8: Greedy Extraction with Repair
  // ===========================================================================

  describe("Strategy 8: Greedy extraction with repair", () => {
    it("extracts and repairs from severely malformed response", () => {
      // Arrange
      const input = 'result: {"a": 1} end';

      // Act
      const result = client.testExtractJSON(input);

      // Assert
      expect(result).toBe('{"a": 1}');
    });

    it("handles mixed brackets/braces in surrounding text", () => {
      // Arrange - has brackets in text but valid JSON in middle
      const input = 'array[0] = {"valid": true} // comment';

      // Act
      const result = client.testExtractJSON(input);

      // Assert
      expect(result).toBe('{"valid": true}');
    });
  });

  // ===========================================================================
  // repairJSON Specific Tests
  // ===========================================================================

  describe("repairJSON", () => {
    it("removes trailing comma in object", () => {
      // Arrange
      const input = '{"a": 1,}';

      // Act
      const result = client.testRepairJSON(input);

      // Assert
      expect(JSON.parse(result)).toEqual({ a: 1 });
    });

    it("removes trailing comma in array", () => {
      // Arrange
      const input = "[1, 2,]";

      // Act
      const result = client.testRepairJSON(input);

      // Assert
      expect(JSON.parse(result)).toEqual([1, 2]);
    });

    it("removes multiple trailing commas", () => {
      // Arrange
      const input = '{"arr": [1, 2,], "obj": {"a": 1,},}';

      // Act
      const result = client.testRepairJSON(input);

      // Assert
      expect(JSON.parse(result)).toEqual({ arr: [1, 2], obj: { a: 1 } });
    });

    it("handles control characters - newlines", () => {
      // Arrange - actual newline in string (not escaped)
      const input = '{"text": "line1\nline2"}';

      // Act
      const result = client.testRepairJSON(input);

      // Assert
      // Should have escaped newlines
      expect(result).toContain("\\n");
      expect(JSON.parse(result).text).toBe("line1\nline2");
    });

    it("handles control characters - tabs", () => {
      // Arrange - actual tab in string
      const input = '{"text": "col1\tcol2"}';

      // Act
      const result = client.testRepairJSON(input);

      // Assert
      expect(result).toContain("\\t");
      expect(JSON.parse(result).text).toBe("col1\tcol2");
    });

    it("returns null for truncated property without value (known limitation)", () => {
      // Arrange - truncated before value (property key present but no value)
      // This is a known limitation: {"a": 1, "b": can't be repaired cleanly
      // because "b": without a value is syntactically invalid
      const input = '{"a": 1, "b":';

      // Act - use full extraction pipeline
      const result = client.testExtractJSON(input);

      // Assert - this case returns null (known limitation)
      expect(result).toBeNull();
    });

    it("handles truncated property with partial value", () => {
      // Arrange - truncated mid-value (this CAN be repaired)
      const input = '{"a": 1, "b": "partial';

      // Act
      const result = client.testExtractJSON(input);

      // Assert - string gets closed and object completed
      expect(result).not.toBeNull();
      const parsed = JSON.parse(result!);
      expect(parsed.a).toBe(1);
      expect(parsed.b).toBe("partial");
    });

    it("repairJSON removes trailing comma after truncated property removal", () => {
      // Arrange - property with value but trailing comma
      const input = '{"a": 1, "b": 2,}';

      // Act
      const result = client.testRepairJSON(input);

      // Assert
      const parsed = JSON.parse(result);
      expect(parsed.a).toBe(1);
      expect(parsed.b).toBe(2);
    });

    it("adds missing closing braces", () => {
      // Arrange
      const input = '{"a": {"b": 1';

      // Act
      const result = client.testRepairJSON(input);

      // Assert
      const parsed = JSON.parse(result);
      expect(parsed.a.b).toBe(1);
    });

    it("adds missing closing brackets", () => {
      // Arrange
      const input = '{"arr": [1, 2, [3, 4';

      // Act
      const result = client.testRepairJSON(input);

      // Assert
      const parsed = JSON.parse(result);
      expect(parsed.arr).toEqual([1, 2, [3, 4]]);
    });

    it("handles truncation mid-string value", () => {
      // Arrange - truncated in middle of string
      const input = '{"name": "hello';

      // Act
      const result = client.testRepairJSON(input);

      // Assert
      const parsed = JSON.parse(result);
      expect(parsed.name).toBe("hello");
    });
  });

  // ===========================================================================
  // isValidJSON Tests
  // ===========================================================================

  describe("isValidJSON", () => {
    it("returns false for null input", () => {
      // Arrange & Act
      const result = client.testIsValidJSON(null as unknown as string);

      // Assert
      expect(result).toBe(false);
    });

    it("returns false for undefined input", () => {
      // Arrange & Act
      const result = client.testIsValidJSON(undefined as unknown as string);

      // Assert
      expect(result).toBe(false);
    });

    it("returns false for non-string input (number)", () => {
      // Arrange & Act
      const result = client.testIsValidJSON(42 as unknown as string);

      // Assert
      expect(result).toBe(false);
    });

    it("returns false for primitive string value", () => {
      // Arrange & Act
      const result = client.testIsValidJSON('"hello"');

      // Assert
      expect(result).toBe(false);
    });

    it("returns false for primitive number value", () => {
      // Arrange & Act
      const result = client.testIsValidJSON("42");

      // Assert
      expect(result).toBe(false);
    });

    it("returns false for primitive boolean value", () => {
      // Arrange & Act
      const result = client.testIsValidJSON("true");

      // Assert
      expect(result).toBe(false);
    });

    it("returns false for primitive null value", () => {
      // Arrange & Act
      const result = client.testIsValidJSON("null");

      // Assert
      expect(result).toBe(false);
    });

    it("returns true for valid object", () => {
      // Arrange & Act
      const result = client.testIsValidJSON('{"key": "value"}');

      // Assert
      expect(result).toBe(true);
    });

    it("returns true for valid array", () => {
      // Arrange & Act
      const result = client.testIsValidJSON("[1, 2, 3]");

      // Assert
      expect(result).toBe(true);
    });

    it("returns true for empty object", () => {
      // Arrange & Act
      const result = client.testIsValidJSON("{}");

      // Assert
      expect(result).toBe(true);
    });

    it("returns true for empty array", () => {
      // Arrange & Act
      const result = client.testIsValidJSON("[]");

      // Assert
      expect(result).toBe(true);
    });

    it("returns false for invalid JSON string", () => {
      // Arrange & Act
      const result = client.testIsValidJSON("{invalid json}");

      // Assert
      expect(result).toBe(false);
    });

    it("returns false for empty string", () => {
      // Arrange & Act
      const result = client.testIsValidJSON("");

      // Assert
      expect(result).toBe(false);
    });
  });

  // ===========================================================================
  // Edge Cases
  // ===========================================================================

  describe("Edge cases", () => {
    it("returns null for empty string", () => {
      // Arrange
      const input = "";

      // Act
      const result = client.testExtractJSON(input);

      // Assert
      expect(result).toBeNull();
    });

    it("returns null for whitespace only", () => {
      // Arrange
      const input = "   \n\t  ";

      // Act
      const result = client.testExtractJSON(input);

      // Assert
      expect(result).toBeNull();
    });

    it("returns null for null input", () => {
      // Arrange & Act
      const result = client.testExtractJSON(null as unknown as string);

      // Assert
      expect(result).toBeNull();
    });

    it("returns null for undefined input", () => {
      // Arrange & Act
      const result = client.testExtractJSON(undefined as unknown as string);

      // Assert
      expect(result).toBeNull();
    });

    it("returns null for non-string input", () => {
      // Arrange & Act
      const result = client.testExtractJSON(42 as unknown as string);

      // Assert
      expect(result).toBeNull();
    });

    it("returns null for plain text without JSON", () => {
      // Arrange
      const input = "This is just plain text without any JSON structure.";

      // Act
      const result = client.testExtractJSON(input);

      // Assert
      expect(result).toBeNull();
    });

    it("returns null when all strategies fail", () => {
      // Arrange - has braces but completely invalid structure
      const input = "{ this is not } valid { json at all }";

      // Act
      const result = client.testExtractJSON(input);

      // Assert
      expect(result).toBeNull();
    });

    it("handles very long JSON strings", () => {
      // Arrange
      const items = Array(100).fill(null).map((_, i) => ({ id: i, name: `item-${i}` }));
      const input = JSON.stringify({ items });

      // Act
      const result = client.testExtractJSON(input);

      // Assert
      expect(result).not.toBeNull();
      const parsed = JSON.parse(result!);
      expect(parsed.items.length).toBe(100);
    });

    it("handles unicode characters in JSON", () => {
      // Arrange
      const input = '{"emoji": "Hello!"}';

      // Act
      const result = client.testExtractJSON(input);

      // Assert
      expect(result).not.toBeNull();
      expect(JSON.parse(result!).emoji).toBe("Hello!");
    });

    it("handles special characters in strings", () => {
      // Arrange
      const input = '{"path": "C:\\\\Users\\\\test", "url": "https://example.com/path?a=1&b=2"}';

      // Act
      const result = client.testExtractJSON(input);

      // Assert
      expect(result).not.toBeNull();
      const parsed = JSON.parse(result!);
      expect(parsed.path).toBe("C:\\Users\\test");
      expect(parsed.url).toBe("https://example.com/path?a=1&b=2");
    });
  });

  // ===========================================================================
  // extractBalancedJSON Specific Tests
  // ===========================================================================

  describe("extractBalancedJSON", () => {
    it("returns null if content does not start with openChar", () => {
      // Arrange
      const input = 'text {"a": 1}';

      // Act
      const result = client.testExtractBalancedJSON(input, "{", "}");

      // Assert
      expect(result).toBeNull();
    });

    it("extracts balanced object", () => {
      // Arrange
      const input = '{"a": {"b": 1}} trailing';

      // Act
      const result = client.testExtractBalancedJSON(input, "{", "}");

      // Assert
      expect(result).toBe('{"a": {"b": 1}}');
    });

    it("extracts balanced array", () => {
      // Arrange
      const input = "[[1, 2], [3, 4]] trailing";

      // Act
      const result = client.testExtractBalancedJSON(input, "[", "]");

      // Assert
      expect(result).toBe("[[1, 2], [3, 4]]");
    });

    it("returns null for unbalanced - missing closing", () => {
      // Arrange
      const input = '{"a": {"b": 1}';

      // Act
      const result = client.testExtractBalancedJSON(input, "{", "}");

      // Assert
      expect(result).toBeNull();
    });

    it("handles escaped backslashes before quotes", () => {
      // Arrange - has \\" which is backslash followed by quote
      const input = '{"path": "C:\\\\"} trailing';

      // Act
      const result = client.testExtractBalancedJSON(input, "{", "}");

      // Assert
      expect(result).toBe('{"path": "C:\\\\"}');
    });

    it("handles strings with internal braces", () => {
      // Arrange
      const input = '{"template": "<div>{content}</div>"} extra';

      // Act
      const result = client.testExtractBalancedJSON(input, "{", "}");

      // Assert
      expect(result).toBe('{"template": "<div>{content}</div>"}');
    });
  });

  // ===========================================================================
  // Integration-style tests (full extraction pipeline)
  // ===========================================================================

  describe("Full extraction pipeline", () => {
    it.each([
      // Direct parse
      ['{"simple": true}', '{"simple": true}'],
      // With trailing text
      ['{"a": 1} explanation follows', '{"a": 1}'],
      // Code block
      ['```json\n{"in": "block"}\n```', '{"in": "block"}'],
      // With leading text
      ['Here is the JSON: {"data": 123}', '{"data": 123}'],
      // Array extraction
      ["[1, 2, 3] done", "[1, 2, 3]"],
      // Complex nested
      ['Intro {"outer": {"inner": [1, 2]}} end', '{"outer": {"inner": [1, 2]}}'],
    ])("extracts JSON from: %s", (input, expected) => {
      const result = client.testExtractJSON(input);
      expect(result).toBe(expected);
    });

    it("handles realistic AI response with explanation", () => {
      // Arrange
      const input = `I've analyzed your request. Here's the result:

{"status": "success", "data": {"items": [{"id": 1, "name": "First"}, {"id": 2, "name": "Second"}], "total": 2}}

This response contains the processed items you requested.`;

      // Act
      const result = client.testExtractJSON(input);

      // Assert
      expect(result).not.toBeNull();
      const parsed = JSON.parse(result!);
      expect(parsed.status).toBe("success");
      expect(parsed.data.items.length).toBe(2);
      expect(parsed.data.total).toBe(2);
    });

    it("handles AI response with code block formatting", () => {
      // Arrange
      const input = `Based on my analysis, here's the structured output:

\`\`\`json
{
  "recommendations": [
    {"priority": "high", "action": "Update dependencies"},
    {"priority": "medium", "action": "Add error handling"}
  ],
  "confidence": 0.95
}
\`\`\`

Let me know if you need more details.`;

      // Act
      const result = client.testExtractJSON(input);

      // Assert
      expect(result).not.toBeNull();
      const parsed = JSON.parse(result!);
      expect(parsed.recommendations.length).toBe(2);
      expect(parsed.confidence).toBe(0.95);
    });
  });
});
