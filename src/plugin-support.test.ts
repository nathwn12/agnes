import { describe, it, expect } from "bun:test";
import * as fs from "node:fs";
import * as path from "node:path";
import { detectProject } from "./plugin-support";

describe("plugin-support", () => {
  it("detects project profile from files", () => {
    const tmp = fs.mkdtempSync(path.join(path.dirname(import.meta.dir), "plugin-support-"));
    try {
      fs.writeFileSync(path.join(tmp, "package.json"), JSON.stringify({ name: "demo" }), "utf8");
      fs.writeFileSync(path.join(tmp, "tsconfig.json"), "{}", "utf8");
      fs.writeFileSync(path.join(tmp, "bun.lock"), "", "utf8");

      const profile = detectProject(tmp);
      expect(profile.projectName).toBe("demo");
      expect(profile.languages).toContain("typescript");
      expect(profile.packageManager).toBe("bun");
    } finally {
      fs.rmSync(tmp, { recursive: true, force: true });
    }
  });
});
