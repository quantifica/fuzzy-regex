import { fuzzyRegex } from ".";

describe("fuzzyRegex", () => {
  describe("test", () => {
    it("should return true if the string is fuzzy matched", () => {
      const regex = fuzzyRegex("fooooo");
      expect(regex.test("mooooo")).toBe(true);
    });

    it("should be case insensitive by default", () => {
      const regex = fuzzyRegex("foOooo");
      expect(regex.test("mooooo")).toBe(true);
    });

    it("should allow overriding case insensitivity", () => {
      const regex = fuzzyRegex("foOooo", { caseInsensitive: false });
      expect(regex.test("mooooo")).toBe(false);
    });

    it("should return false if the string is not fuzzy matched", () => {
      const regex = fuzzyRegex("fooooo");
      expect(regex.test("mowooo")).toBe(false);
    });

    it("should allow more errors on a long string", () => {
      const regex = fuzzyRegex("we really like to party");
      expect(regex.test("wereally like toparty")).toBe(true);
    });

    it("should default to 1 error per 10 characters", () => {
      const regex = fuzzyRegex("lorem ipsum");
      expect(regex.test("Lo4em ipsum dolor sit amet")).toBe(true);
      expect(regex.test("Lo4em 1psum dolor sit amet")).toBe(false);
    });

    it("should allow overriding max errors", () => {
      const regex = fuzzyRegex("we really like to party", {
        maxErr: 1,
      });
      expect(regex.test("wereally like toparty")).toBe(false);
    });

    it("should work with RegExp.source", () => {
      const regex = fuzzyRegex(/foo/.source);
      expect(regex.test("foo")).toBe(true);
    });

    it("should work passing a RegExp directly with case sensitivity", () => {
      const regex = fuzzyRegex(/foo/);
      expect(regex.test("Foo")).toBe(false);
    });

    it("should work passing a RegExp directly with case insensitivity", () => {
      const regex = fuzzyRegex(/foo/i);
      expect(regex.test("Foo")).toBe(true);
    });

    it("should throw an error if case sensitivity mismatch", () => {
      expect(() => fuzzyRegex(/foo/i, { caseInsensitive: false })).toThrow(
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

    it("should allow controlling the cost of each operation", () => {
      const regex = fuzzyRegex("page\\s+(\\d+)\\s+of\\s+(\\d+)", {
        costIns: 10,
        costDel: 10,
        costSubst: 1,
        maxCost: 1,
        maxIns: 1,
        maxDel: 1,
        maxSubst: 1,
      });
      expect(regex.exec("page I of 6")?.[1]).toEqual("I");
      expect(regex.exec("page I of 6")?.[2]).toEqual("6");
    });

    it("should allow controlling the max cost", () => {
      const regex = fuzzyRegex("page\\s+(\\d+)\\s+of\\s+(\\d+)", {
        costSubst: 2,
        maxCost: 1,
      });
      expect(regex.exec("page I of 6")?.[1]).toEqual(undefined);
      expect(regex.exec("page I of 6")?.[2]).toEqual(undefined);
    });
  });
});
