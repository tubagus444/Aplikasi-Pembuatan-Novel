import { describe, it, expect } from "vitest";
import { getCodexRegex, countWords, cn } from "./utils";

describe("utils", () => {
  describe("cn", () => {
     it("should merge tailwind classes properly", () => {
         expect(cn("p-4", "p-2")).toBe("p-2");
         expect(cn("text-red-500", false && "text-blue-500")).toBe("text-red-500");
     });
  });

  describe("getCodexRegex", () => {
     it("should match standard words", () => {
         const regex = getCodexRegex("Kael");
         expect("Halo Kael, apa kabar?".match(regex)).toBeTruthy();
         expect("Mikael".match(regex)).toBeFalsy();
         expect("Kaelnya bilang begitu".match(regex)).toBeTruthy(); // test particle
     });

     it("should be case insensitive by default", () => {
         const regex = getCodexRegex("Kael");
         expect("kael".match(regex)).toBeTruthy();
         expect("KAEL".match(regex)).toBeTruthy();
     });

     it("should handle names with special characters (fallback mode)", () => {
         const regex = getCodexRegex("A.I.");
         expect("This is an A.I. system".match(regex)).toBeTruthy();
     });
  });

  describe("countWords", () => {
     it("should strip HTML and count words", () => {
         expect(countWords("<p>Hello world!</p>")).toBe(2);
         expect(countWords("Just   some   text.")).toBe(3);
         expect(countWords("")).toBe(0);
         expect(countWords("<br/>")).toBe(0);
     });
  });
});
