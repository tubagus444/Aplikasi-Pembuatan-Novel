import { describe, it, expect } from "vitest";
import { resolveLoreTags, parseMentionTags } from "./loreUtils";
import { CodexEntry, StoryBibleRule } from "@/src/types";

describe("loreUtils", () => {
  describe("resolveLoreTags", () => {
    it("should resolve rule tags", () => {
      const rules: StoryBibleRule[] = [
        { id: 1, projectId: 1, key: "MAGIC", instruction: "No magic exists." }
      ];
      const result = resolveLoreTags("The world has @rule:MAGIC see?", [], rules);
      expect(result).toBe("The world has [Rule - MAGIC: No magic exists.] see?");
    });

    it("should resolve codex tags", () => {
      const codex: CodexEntry[] = [
        { id: 1, projectId: 1, name: "Kael", aliases: [], description: "A simple farmer.", category: "character", tags: [] }
      ];
      const result = resolveLoreTags("Here comes @codex:Kael today.", codex, []);
      expect(result).toBe("Here comes [Lore - Kael: A simple farmer.] today.");
    });

    it("should resolve codex tags with underscore substituting spaces", () => {
      const codex: CodexEntry[] = [
        { id: 1, projectId: 1, name: "Red Dragon", aliases: [], description: "A big beast.", category: "character", tags: [] }
      ];
      const result = resolveLoreTags("Fight the @codex:Red_Dragon now.", codex, []);
      expect(result).toBe("Fight the [Lore - Red Dragon: A big beast.] now.");
    });
    
    it("should untouched unresolved tags", () => {
       expect(resolveLoreTags("Fight @codex:Red_Dragon")).toBe("Fight @codex:Red_Dragon");
    });
  });

  describe("parseMentionTags", () => {
    it("should parse multiple mentions", () => {
      const segments = parseMentionTags("See @codex:Kael and @rule:MAGIC then @chapter-excerpt ok.");
      
      expect(segments.length).toBe(7);
      expect(segments[0].text).toBe("See ");
      expect(segments[1].isMention).toBe(true);
      expect(segments[1].type).toBe("codex");
      expect(segments[1].value).toBe("Kael");

      expect(segments[3].isMention).toBe(true);
      expect(segments[3].type).toBe("rule");
      expect(segments[3].value).toBe("MAGIC");

      expect(segments[5].isMention).toBe(true);
      expect(segments[5].type).toBe("chapter");
      expect(segments[5].value).toBe("chapter-excerpt");
    });
  });
});
