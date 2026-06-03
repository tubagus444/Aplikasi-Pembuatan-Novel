import { describe, it, expect } from "vitest";
import { splitIntoScenes, getRelevantScenes, buildExcerptContext } from "./chunkEngine";
import { CodexEntry } from "@/src/types";

describe("chunkEngine", () => {
  describe("splitIntoScenes", () => {
    it("should split content by *** and ---", () => {
      const content = "Scene A\n***\nScene B\n---\nScene C";
      const scenes = splitIntoScenes(content);
      
      expect(scenes.length).toBe(3);
      expect(scenes[0].content).toBe("Scene A");
      expect(scenes[0].index).toBe(0);
      expect(scenes[1].content).toBe("Scene B");
      expect(scenes[2].content).toBe("Scene C");
    });

    it("should split by three or more empty lines", () => {
      const content = "Scene A\n\n\n\nScene B\n\n\nScene C";
      const scenes = splitIntoScenes(content);
      expect(scenes.length).toBe(3);
      expect(scenes[0].content).toBe("Scene A");
      expect(scenes[1].content).toBe("Scene B");
      expect(scenes[2].content).toBe("Scene C");
    });

    it("should return a single scene if no separators exist", () => {
      const content = "Just one big text block\nWith two lines.";
      const scenes = splitIntoScenes(content);
      expect(scenes.length).toBe(1);
      expect(scenes[0].content).toBe("Just one big text block\nWith two lines.");
      expect(scenes[0].index).toBe(0);
    });

    it("should handle empty strings", () => {
      const scenes = splitIntoScenes("");
      expect(scenes.length).toBe(0);
    });
  });

  describe("getRelevantScenes", () => {
    const scenes = [
      { index: 0, content: "The fox jumped over the fence.", wordCount: 6 },
      { index: 1, content: "Alice looked at the rabbit hole.", wordCount: 6 },
      { index: 2, content: "Bob was angry at Alice.", wordCount: 5 }
    ];

    const codex: CodexEntry[] = [
      {
        id: 1,
        projectId: 1,
        name: "Alice",
        aliases: ["Alicia"],
        description: "",
        category: "character",
        tags: [],
      },
      {
        id: 2,
        projectId: 1,
        name: "Bob",
        aliases: [],
        description: "",
        category: "character",
        tags: [],
      }
    ];

    it("should return relevant scenes based on keyword match", () => {
       const result = getRelevantScenes("Where is Alice?", scenes, codex);
       // Should match Scene 1 and Scene 2, but max 2 scenes, sorted chronologically
       expect(result.length).toBe(2);
       expect(result[0].index).toBe(1);
       expect(result[1].index).toBe(2);
    });

    it("should return empty if no matches", () => {
       const result = getRelevantScenes("Does Godzilla appear?", scenes, codex);
       expect(result.length).toBe(0);
    });
  });

  describe("buildExcerptContext", () => {
     it("should format scene text correctly", () => {
        const scenes = [
            { index: 1, content: "Scene one text.", wordCount: 3 },
            { index: 2, content: "Scene two text.", wordCount: 3 }
        ];
        const excerpt = buildExcerptContext(scenes);
        expect(excerpt).toContain("[CHAPTER EXCERPT]");
        expect(excerpt).toContain("Scene one text.\n\n[...]\n\nScene two text.");
        expect(excerpt).toContain("[END EXCERPT]");
     });
  });
});
