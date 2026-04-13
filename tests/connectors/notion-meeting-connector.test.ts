import { describe, it, expect } from "vitest";
import { NotionMeetingConnector } from "../../src/connectors/notion-meeting-connector";

describe("NotionMeetingConnector", () => {
  it("returns empty when no API key", async () => {
    const connector = new NotionMeetingConnector({ apiKey: "", databaseId: "fake" });
    const results = await connector.fetchMeetingNotes({ apiKey: "", databaseId: "fake" });
    expect(results).toEqual([]);
  });

  it("parses meeting page correctly", async () => {
    const connector = new NotionMeetingConnector({ apiKey: "fake", databaseId: "fake" });
    const page = {
      id: "page-123",
      properties: {
        Title: { title: [{ plain_text: "Sprint Planning" }] },
        Date: { date: { start: "2024-03-01" } },
        Attendees: { multi_select: [{ name: "alice" }, { name: "bob" }] },
        Type: { select: { name: "Meeting Notes" } },
      },
      url: "https://notion.so/page-123",
    } as any;
    const parsed = (connector as any).parseMeetingPage(page);
    expect(parsed.title).toBe("Sprint Planning");
    expect(parsed.date).toBe("2024-03-01");
    expect(parsed.attendees).toContain("alice");
  });
});

describe("NotionMeetingConnector parseMeetingPage", () => {
  it("extracts title from Name property as fallback", () => {
    const connector = new NotionMeetingConnector();
    const page = {
      id: "page-456",
      properties: {
        Name: { title: [{ plain_text: "Weekly Sync" }] },
        Date: { date: { start: "2024-04-01" } },
        Attendees: { multi_select: [] },
      },
    } as any;
    const parsed = (connector as any).parseMeetingPage(page);
    expect(parsed.title).toBe("Weekly Sync");
    expect(parsed.id).toBe("page-456");
  });
});
