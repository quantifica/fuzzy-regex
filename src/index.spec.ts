import { fuzzyRegex } from ".";

describe("fuzzyRegex", () => {
  describe("test", () => {
    it("should return true if the string is fuzzy matched", () => {
      const regex = fuzzyRegex("foo");
      expect(regex.test("moo")).toBe(true);
    });

    it("should be case insensitive by default", () => {
      const regex = fuzzyRegex("foO");
      expect(regex.test("moo")).toBe(true);
    });

    it("should allow overriding case insensitivity", () => {
      const regex = fuzzyRegex("foO", false);
      expect(regex.test("moo")).toBe(false);
    });

    it("should return false if the string is not fuzzy matched", () => {
      const regex = fuzzyRegex("foo");
      expect(regex.test("mow")).toBe(false);
    });

    it("should allow more errors on a long string", () => {
      const regex = fuzzyRegex("we really like to party");
      expect(regex.test("wereally like toparty")).toBe(true);
    });

    it("should allow overriding max errors", () => {
      const regex = fuzzyRegex("we really like to party");
      expect(regex.test("wereally like toparty", 1)).toBe(false);
    });

    it("should work with RegExp.source", () => {
      const regex = fuzzyRegex(/foo/.source);
      expect(regex.test("foo")).toBe(true);
    });

    it("should work passing a RegExp directly with case sensitivity", () => {
      const regex = fuzzyRegex(/foo/);
      expect(regex.test("Foo", 0)).toBe(false);
    });

    it("should work passing a RegExp directly with case insensitivity", () => {
      const regex = fuzzyRegex(/foo/i);
      expect(regex.test("Foo", 0)).toBe(true);
    });

    it("should throw an error if case sensitivity mismatch", () => {
      expect(() => fuzzyRegex(/foo/i, false)).toThrow(
        "Case sensitivity mismatch"
      );
    });

    it.each([
      ["foo", "fo"],
      ["fo", "moo"],
    ])("should not allow errors for short strings", ([pattern, str]) => {
      const regex = fuzzyRegex(pattern);
      expect(regex.test(str)).toBe(false);
    });
  });

  describe("exec", () => {
    it("should return the fuzzy matched string", () => {
      const regex = fuzzyRegex("page\\s+(\\d+)\\s+of\\s+(\\d+)");
      expect(regex.exec("page I of 6")?.[1]).toEqual("I");
      expect(regex.exec("page I of 6")?.[2]).toEqual("6");
    });
  });
});
