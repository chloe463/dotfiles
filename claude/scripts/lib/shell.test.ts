import { expect, describe, it } from "bun:test";
import { homedir } from "node:os";
import { parseGit, resolveCommands, splitCommands } from "./shell";

const words = (command: string) => splitCommands(command).map((c) => c.words);

describe("splitCommands", () => {
  it("splits on shell operators", () => {
    expect(words("git add . && git commit -m x; git push | cat")).toEqual([
      ["git", "add", "."],
      ["git", "commit", "-m", "x"],
      ["git", "push"],
      ["cat"],
    ]);
  });
  it("keeps quoted operators inside a word", () => {
    expect(words(`git commit -m "a && git push"`)).toEqual([["git", "commit", "-m", "a && git push"]]);
    expect(words("echo 'x; git push'")).toEqual([["echo", "x; git push"]]);
  });
  it("splits on newlines", () => {
    expect(words("cd repo\ngit push")).toEqual([["cd", "repo"], ["git", "push"]]);
  });

  describe("here-documents", () => {
    it("attaches the body to the command instead of parsing it", () => {
      expect(splitCommands("git commit -F - <<'EOF'\nfix: x\n\ngit push origin main\nEOF\ngit status")).toEqual([
        { words: ["git", "commit", "-F", "-"], heredocs: ["fix: x\n\ngit push origin main\n"] },
        { words: ["git", "status"], heredocs: [] },
      ]);
    });
    it("accepts unquoted and double-quoted delimiters", () => {
      expect(splitCommands("cat <<EOF\na\nEOF")[0].heredocs).toEqual(["a\n"]);
      expect(splitCommands('cat << "END"\na\nEND')[0].heredocs).toEqual(["a\n"]);
    });
    it("strips leading tabs with <<-", () => {
      expect(splitCommands("cat <<-EOF\n\ta\n\tEOF\necho done")).toEqual([
        { words: ["cat"], heredocs: ["a\n"] },
        { words: ["echo", "done"], heredocs: [] },
      ]);
    });
    it("keeps parsing the rest of the opening line", () => {
      expect(splitCommands("cat <<EOF | git commit -F -\nmsg\nEOF")).toEqual([
        { words: ["cat"], heredocs: ["msg\n"] },
        { words: ["git", "commit", "-F", "-"], heredocs: [] },
      ]);
    });
    it("reads multiple here-documents in order", () => {
      expect(splitCommands("cat <<A <<B\n1\nA\n2\nB")[0].heredocs).toEqual(["1\n", "2\n"]);
    });
    it("treats a missing terminator as running to the end", () => {
      expect(splitCommands("cat <<EOF\na\nb")[0].heredocs).toEqual(["a\nb\n"]);
    });
    it("leaves here-documents inside quotes to the quoted word", () => {
      const [cmd] = splitCommands(`git commit -m "$(cat <<'EOF'\nfix: x\nEOF\n)"`);
      expect(cmd.words).toEqual(["git", "commit", "-m", "$(cat <<'EOF'\nfix: x\nEOF\n)"]);
      expect(cmd.heredocs).toEqual([]);
    });
  });

  it("attaches here-strings as input", () => {
    expect(splitCommands("git commit -F - <<< 'fix: x'")).toEqual([
      { words: ["git", "commit", "-F", "-"], heredocs: ["fix: x"] },
    ]);
  });
});

describe("resolveCommands", () => {
  it("follows cd and drops the cd commands", () => {
    expect(resolveCommands("cd sub && git push; cd ~ && ls", "/r").map((c) => [c.words[0], c.cwd])).toEqual([
      ["git", "/r/sub"],
      ["ls", homedir()],
    ]);
  });
});

describe("parseGit", () => {
  it("returns null for other commands", () => {
    expect(parseGit(["echo", "git", "push"], "/r")).toBeNull();
    expect(parseGit(["git"], "/r")).toBeNull();
  });
  it("skips env assignments and global options, resolving -C", () => {
    expect(parseGit(["GIT_TRACE=1", "git", "-C", "sub", "-c", "a=b", "--no-pager", "commit", "-m", "x"], "/r")).toEqual(
      { dir: "/r/sub", args: ["commit", "-m", "x"] },
    );
  });
});
