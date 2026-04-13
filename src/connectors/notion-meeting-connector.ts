// src/connectors/notion-meeting-connector.ts
/**
 * Notion Meeting Connector — fetches meeting notes from Notion databases.
 * Requires NOTION_API_KEY env var.
 */

export interface NotionMeetingPage {
  id: string;
  title: string;
  content: string;
  date: string;
  attendees: string[];
  meetingType?: string;
  url?: string;
}

export interface NotionConfig {
  apiKey: string;
  databaseId: string;
  filterProperty?: string;
  filterValue?: string;
}

const NOTION_API = "https://api.notion.com/v1";
const NOTION_VERSION = "2022-06-28";

export class NotionMeetingConnector {
  private apiKey: string;

  constructor(config?: NotionConfig) {
    this.apiKey = config?.apiKey ?? process.env.NOTION_API_KEY ?? "";
    if (!this.apiKey) {
      console.warn("[notion] NOTION_API_KEY not set — connector will return empty results");
    }
  }

  /**
   * Query Notion database for meeting note pages.
   */
  async fetchMeetingNotes(config: NotionConfig, options?: {
    startDate?: string;
    endDate?: string;
    limit?: number;
  }): Promise<NotionMeetingPage[]> {
    if (!this.apiKey) return [];

    const { startDate, endDate, limit = 50 } = options ?? {};
    const filter: Record<string, unknown> = {
      and: [
        { property: config.filterProperty ?? "Type", select: { equals: config.filterValue ?? "Meeting Notes" } },
        ...(startDate ? [{ property: "Date", date: { on_or_after: startDate } }] : []),
        ...(endDate ? [{ property: "Date", date: { on_or_before: endDate } }] : []),
      ],
    };

    try {
      const response = await fetch(`${NOTION_API}/databases/${config.databaseId}/query`, {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${this.apiKey}`,
          "Notion-Version": NOTION_VERSION,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ filter, page_size: Math.min(limit, 100) }),
      });

      if (!response.ok) {
        console.error(`[notion] query failed: ${response.status} ${response.statusText}`);
        return [];
      }

      const data = await response.json() as { results?: unknown[] };
      return ((data.results ?? []) as unknown[]).map((page) => this.parseMeetingPage(page));
    } catch (e) {
      console.error("[notion] fetchMeetingNotes error:", e);
      return [];
    }
  }

  /**
   * Fetch a single Notion page's content.
   */
  async fetchPageContent(pageId: string): Promise<string> {
    if (!this.apiKey) return "";

    try {
      const response = await fetch(`${NOTION_API}/blocks/${pageId}/children?page_size=100`, {
        headers: {
          "Authorization": `Bearer ${this.apiKey}`,
          "Notion-Version": NOTION_VERSION,
        },
      });
      if (!response.ok) return "";
      const data = await response.json() as { results?: unknown[] };
      return ((data.results ?? []) as unknown[])
        .map((block: unknown) => {
          const b = block as Record<string, unknown>;
          const blockType = b[b.type as string] as Record<string, unknown> | undefined;
          const richText = blockType?.rich_text as Array<{ plain_text?: string }> | undefined;
          return (richText ?? []).map((t) => t.plain_text ?? "").join("");
        })
        .join("\n");
    } catch (e) {
      console.error("[notion] fetchPageContent error:", e);
      return "";
    }
  }

  private parseMeetingPage(page: unknown): NotionMeetingPage {
    const p = page as Record<string, unknown>;
    const props = (p.properties ?? {}) as Record<string, unknown>;
    const titleProp = props.Title ?? props.Name;
    const titleArr = (titleProp as { title?: Array<{ plain_text?: string }> })?.title ?? [];
    return {
      id: p.id as string,
      title: titleArr[0]?.plain_text ?? "Untitled",
      content: "",  // fetched separately via fetchPageContent
      date: ((props.Date as { date?: { start?: string } })?.date?.start) ?? "",
      attendees: ((props.Attendees as { multi_select?: Array<{ name?: string }> })?.multi_select ?? []).map((s) => s.name ?? ""),
      meetingType: (props.Type as { select?: { name?: string } })?.select?.name,
      url: p.url as string | undefined,
    };
  }
}
