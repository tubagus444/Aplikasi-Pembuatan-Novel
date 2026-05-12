
export interface MatchResult {
  start: number;
  end: number;
  keyword: string;
  data: any;
}

class TrieNode {
  children: Map<string, TrieNode> = new Map();
  fail: TrieNode | null = null;
  output: { keyword: string; data: any }[] = [];
}

export class AhoCorasick {
  private root: TrieNode = new TrieNode();

  constructor(keywords: { word: string; data: any }[]) {
    this.buildTrie(keywords);
    this.buildFailureLinks();
  }

  private buildTrie(keywords: { word: string; data: any }[]) {
    for (const { word, data } of keywords) {
      if (!word) continue;
      let node = this.root;
      const lowerWord = word.toLowerCase();
      for (const char of lowerWord) {
        if (!node.children.has(char)) {
          node.children.set(char, new TrieNode());
        }
        node = node.children.get(char)!;
      }
      node.output.push({ keyword: word, data });
    }
  }

  private buildFailureLinks() {
    const queue: TrieNode[] = [];
    for (const child of this.root.children.values()) {
      child.fail = this.root;
      queue.push(child);
    }

    while (queue.length > 0) {
      const current = queue.shift()!;
      for (const [char, child] of current.children) {
        let f = current.fail;
        while (f !== null && !f.children.has(char)) {
          f = f.fail;
        }
        child.fail = f ? f.children.get(char)! : this.root;
        // Merge output from failure link to handle substrings
        child.output.push(...child.fail.output);
        queue.push(child);
      }
    }
  }

  public search(text: string): MatchResult[] {
    const results: MatchResult[] = [];
    let node = this.root;
    const lowerText = text.toLowerCase();

    for (let i = 0; i < lowerText.length; i++) {
        const char = lowerText[i];
        while (node !== this.root && !node.children.has(char)) {
            node = node.fail!;
        }
        node = node.children.get(char) || this.root;

        for (const out of node.output) {
            const start = i - out.keyword.length + 1;
            
            // Boundary check: ensure it's a whole word or Indonesian suffix
            const prevChar = start > 0 ? text[start - 1] : ' ';
            const nextChar = i < text.length - 1 ? text[i + 1] : ' ';
            
            const isPrevBoundary = !/[a-zA-Z0-9]/.test(prevChar);
            const isNextBoundary = !/[a-zA-Z0-9]/.test(nextChar);

            if (isPrevBoundary && isNextBoundary) {
                results.push({
                    start,
                    end: i + 1,
                    keyword: out.keyword,
                    data: out.data
                });
            }
        }
    }

    // Resolve overlaps: Keep longest match
    results.sort((a, b) => {
        if (a.start !== b.start) return a.start - b.start;
        return (b.end - b.start) - (a.end - a.start);
    });

    const finalResults: MatchResult[] = [];
    let lastEnd = -1;
    for (const res of results) {
        if (res.start >= lastEnd) {
            finalResults.push(res);
            lastEnd = res.end;
        }
    }

    return finalResults;
  }
}
