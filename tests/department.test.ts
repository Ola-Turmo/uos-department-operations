import { describe, expect, it } from "vitest";
import { connectors, department, jobs, roles, skills } from "../src";

describe("@uos/department-operations", () => {
  it("captures the operations department boundary", () => {
    expect(department.departmentId).toBe("operations");
    expect(department.parentFunctionId).toBe("operations");
    expect(department.moduleId).toBeNull();
  });

  it("includes the operations leadership and execution roles", () => {
    expect(roles.some((role) => role.roleKey === "operations")).toBe(true);
    expect(roles.some((role) => role.roleKey === "operations-automation-operator")).toBe(true);
    expect(jobs.map((job) => job.jobKey)).toEqual([
      "operations-weekly-review",
      "operations-knowledge-refresh",
    ]);
  });

  it("keeps the operations skills and planning toolkits together", () => {
    expect(skills.bundleIds).toContain("uos-operations");
    expect(skills.externalSkills.some((skill) => skill.id === "uos-external-process-docs")).toBe(true);
    expect(connectors.requiredToolkits).toContain("slack");
    expect(connectors.requiredToolkits).toContain("notion");
    expect(connectors.roleToolkits.some((role) => role.roleKey === "operations-automation-operator")).toBe(true);
  });
});
