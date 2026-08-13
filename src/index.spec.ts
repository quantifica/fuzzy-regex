import { fuzzyRegex, init } from ".";

describe("fuzzyRegex", () => {
  describe("test", () => {
    it("should return true if the string is fuzzy matched", async () => {
      const regex = await fuzzyRegex("fooooo");
      expect(regex.test("mooooo")).toBe(true);
    });

    it("should be case insensitive by default", async () => {
      const regex = await fuzzyRegex("foOooo");
      expect(regex.test("mooooo")).toBe(true);
    });

    it("should allow overriding case insensitivity", async () => {
      const regex = await fuzzyRegex("foOooo", { caseInsensitive: false });
      expect(regex.test("mooooo")).toBe(false);
    });

    it("should return false if the string is not fuzzy matched", async () => {
      const regex = await fuzzyRegex("fooooo");
      expect(regex.test("mowooo")).toBe(false);
    });

    it("should allow more errors on a long string", async () => {
      const regex = await fuzzyRegex("we really like to party");
      expect(regex.test("wereally like toparty")).toBe(true);
    });

    it("should default to 1 error per 10 characters", async () => {
      const regex = await fuzzyRegex("lorem ipsum");
      expect(regex.test("Lo4em ipsum dolor sit amet")).toBe(true);
      expect(regex.test("Lo4em 1psum dolor sit amet")).toBe(false);
    });

    it("should allow overriding max errors", async () => {
      const regex = await fuzzyRegex("we really like to party", {
        maxErr: 1,
      });
      expect(regex.test("wereally like toparty")).toBe(false);
    });

    it("should match up to the substitution budget and no further", async () => {
      const regex = await fuzzyRegex("foo", {
        maxErr: 2,
        maxCost: 2,
        maxSubst: 2,
      });
      expect(regex.test("foa")).toBe(true);
      expect(regex.test("faa")).toBe(true);
      expect(regex.test("aaa")).toBe(false);
    });

    it("should work with RegExp.source", async () => {
      const regex = await fuzzyRegex(/foo/.source);
      expect(regex.test("foo")).toBe(true);
    });

    it("should work passing a RegExp directly with case sensitivity", async () => {
      const regex = await fuzzyRegex(/foo/);
      expect(regex.test("Foo")).toBe(false);
    });

    it("should work passing a RegExp directly with case insensitivity", async () => {
      const regex = await fuzzyRegex(/foo/i);
      expect(regex.test("Foo")).toBe(true);
    });

    it("should throw an error if case sensitivity mismatch", async () => {
      await expect(fuzzyRegex(/foo/i, { caseInsensitive: false })).rejects.toThrow(
        "Case sensitivity mismatch"
      );
    });

    it.each([
      ["foo", "fo"],
      ["fo", "moo"],
    ])("should not allow errors for short strings", async (pattern, str) => {
      const regex = await fuzzyRegex(pattern);
      expect(regex.test(str)).toBe(false);
    });
  });

  describe("exec", () => {
    it("should return the fuzzy matched string", async () => {
      const regex = await fuzzyRegex("page\\s+(\\d+)\\s+of\\s+(\\d+)");
      expect(regex.exec("page I of 6")?.[1]).toEqual("I");
      expect(regex.exec("page I of 6")?.[2]).toEqual("6");
    });

    it("should return the whole match at index 0", async () => {
      const regex = await fuzzyRegex("page\\s+(\\d+)\\s+of\\s+(\\d+)");
      expect(regex.exec("see page I of 6 now")?.[0]).toEqual("page I of 6");
    });

    it("should allow controlling the cost of each operation", async () => {
      const regex = await fuzzyRegex("page\\s+(\\d+)\\s+of\\s+(\\d+)", {
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

    it("should allow controlling the max cost", async () => {
      const regex = await fuzzyRegex("page\\s+(\\d+)\\s+of\\s+(\\d+)", {
        costSubst: 2,
        maxCost: 1,
      });
      expect(regex.exec("page I of 6")?.[1]).toEqual(undefined);
      expect(regex.exec("page I of 6")?.[2]).toEqual(undefined);
    });

    it("should return null when there is no match", async () => {
      const regex = await fuzzyRegex("wildly different", { maxErr: 0 });
      expect(regex.exec("nothing alike")).toBeNull();
    });

    it("should return undefined for a group that did not participate", async () => {
      const regex = await fuzzyRegex("a(x)?b", { maxErr: 0, maxCost: 0 });
      const result = regex.exec("ab");
      expect(result?.[0]).toEqual("ab");
      expect(result?.[1]).toBeUndefined();
    });
  });

  describe("patterns", () => {
    it("should throw a SyntaxError for an invalid pattern", async () => {
      await expect(fuzzyRegex("a(")).rejects.toThrow(SyntaxError);
    });

    it("should expose the pattern via toString", async () => {
      const regex = await fuzzyRegex("ab(c)");
      expect(regex.toString()).toEqual("ab(c)");
      expect(`${regex}`).toEqual("ab(c)");
    });

    it("should support POSIX character classes", async () => {
      const regex = await fuzzyRegex("[[:digit:]]+", { maxErr: 0 });
      expect(regex.test("12345")).toBe(true);
      expect(regex.test("abcde")).toBe(false);
    });
  });

  /* The wasm module uses TRE's wide-character entry points, so an "error" is one
     code point rather than one UTF-8 byte and offsets map onto JS string
     indices. See the header comment in bindings/tre_wasm.c. */
  describe("unicode", () => {
    it("should count a non-ASCII substitution as a single error", async () => {
      const regex = await fuzzyRegex("café", {
        maxErr: 1,
        maxCost: 1,
        maxSubst: 1,
        maxIns: 1,
        maxDel: 1,
      });
      expect(regex.test("cafe")).toBe(true);
    });

    it("should not match a non-ASCII string beyond the error budget", async () => {
      const regex = await fuzzyRegex("café", { maxErr: 0, maxCost: 0 });
      expect(regex.test("cafe")).toBe(false);
      expect(regex.test("café")).toBe(true);
    });

    it("should return correct offsets for BMP characters", async () => {
      const regex = await fuzzyRegex("naïve (\\w+)", { maxErr: 0, maxCost: 0 });
      expect(regex.exec("a naïve idea")?.[1]).toEqual("idea");
    });

    it("should return correct offsets past astral characters", async () => {
      const regex = await fuzzyRegex("👍 (\\w+)", { maxErr: 0, maxCost: 0 });
      const result = regex.exec("👍 yes");
      expect(result?.[0]).toEqual("👍 yes");
      expect(result?.[1]).toEqual("yes");
    });

    it("should round-trip an astral character inside a group", async () => {
      const regex = await fuzzyRegex("a(.)c", { maxErr: 0, maxCost: 0 });
      expect(regex.exec("a👍c")?.[1]).toEqual("👍");
    });

    it("should be case insensitive for non-ASCII letters", async () => {
      const regex = await fuzzyRegex("ÉCOLE", { maxErr: 0, maxCost: 0 });
      expect(regex.test("école")).toBe(true);
    });
  });

  describe("free", () => {
    it("should throw when used after being freed", async () => {
      const regex = await fuzzyRegex("foo");
      regex.free();
      expect(() => regex.test("foo")).toThrow("has been freed");
      expect(() => regex.exec("foo")).toThrow("has been freed");
    });

    it("should be safe to call more than once", async () => {
      const regex = await fuzzyRegex("foo");
      regex.free();
      expect(() => regex.free()).not.toThrow();
    });

    it("should still report the pattern after being freed", async () => {
      const regex = await fuzzyRegex("foo");
      regex.free();
      expect(regex.toString()).toEqual("foo");
    });

    it("should not leak across many compiles", async () => {
      for (let i = 0; i < 2000; i++) {
        const regex = await fuzzyRegex(`pattern-${i}-(\\d+)`);
        expect(regex.test(`pattern-${i}-42`)).toBe(true);
        regex.free();
      }
    });
  });

  describe("init", () => {
    it("should return the same module instance when called repeatedly", async () => {
      expect(await init()).toBe(await init());
    });

    it("should let a regex be created without calling init first", async () => {
      const regex = await fuzzyRegex("foo");
      expect(regex.test("foo")).toBe(true);
    });
  });

  describe("long strings", () => {
    it("should match within a string longer than the initial scratch buffer", async () => {
      const regex = await fuzzyRegex("needle", { maxErr: 1 });
      const haystack = `${"x".repeat(50000)}neadle${"y".repeat(50000)}`;
      expect(regex.test(haystack)).toBe(true);
      expect(regex.exec(haystack)?.[0]).toEqual("neadle");
    });

    it("should reuse the scratch buffer across differently sized inputs", async () => {
      const regex = await fuzzyRegex("abc", { maxErr: 0, maxCost: 0 });
      for (const length of [10, 5000, 20, 100000, 1]) {
        expect(regex.test(`${"z".repeat(length)}abc`)).toBe(true);
      }
    });
  });
});
