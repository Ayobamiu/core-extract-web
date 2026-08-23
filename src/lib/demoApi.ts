const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3000";

const TOKEN_KEY = (id: string) => `coreextract-demo:${id}`;

export function demoApiBase() {
  return API_BASE.replace(/\/$/, "");
}

export function saveDemoToken(sessionId: string, token: string) {
  try {
    sessionStorage.setItem(TOKEN_KEY(sessionId), token);
  } catch {
    /* private mode */
  }
}

export function loadDemoToken(sessionId: string): string | null {
  try {
    return sessionStorage.getItem(TOKEN_KEY(sessionId));
  } catch {
    return null;
  }
}

export type DemoClassification = {
  headline: string;
  sections: Array<{
    slug: string;
    displayName: string;
    pages: number[];
    pageCount: number;
    confidence: number | null;
  }>;
  types: Array<{
    slug: string;
    displayName: string;
    pageCount: number;
    pages: number[];
  }>;
};

export type DemoRecord = {
  slug: string | null;
  displayName: string;
  data: Record<string, unknown>;
  schema: unknown;
  confidence: number | null;
  pages: number[];
};

export type DemoEvent = {
  seq: number;
  phase: string;
  status: string;
  message: string | null;
  progress: { current: number; total: number } | null;
  createdAt: string;
};

export type DemoSession = {
  sessionId: string;
  jobId: string;
  fileId: string;
  filename: string;
  pageCount: number;
  status: "queued" | "processing" | "completed" | "failed" | string;
  documentType: string | null;
  classification: DemoClassification | null;
  events: DemoEvent[];
  records: DemoRecord[];
  error: string | null;
  hasLeadEmail: boolean;
  downloaded: boolean;
};

async function parseJson(res: Response) {
  const text = await res.text();
  try {
    return JSON.parse(text);
  } catch {
    throw new Error(text || `Request failed (${res.status})`);
  }
}

export async function createDemoSession(file: File): Promise<{
  sessionId: string;
  token: string;
  filename: string;
  pageCount: number;
}> {
  const body = new FormData();
  body.append("file", file);
  const res = await fetch(`${demoApiBase()}/demo/sessions`, {
    method: "POST",
    body,
  });
  const data = await parseJson(res);
  if (!res.ok || !data.success) {
    throw new Error(data.error || "Could not start the demo");
  }
  saveDemoToken(data.sessionId, data.token);
  return data;
}

export async function getDemoSession(
  sessionId: string,
  token: string,
): Promise<DemoSession> {
  const res = await fetch(`${demoApiBase()}/demo/sessions/${sessionId}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const data = await parseJson(res);
  if (!res.ok || !data.success) {
    throw new Error(data.error || "Session not found");
  }
  return data as DemoSession;
}

export async function getDemoPdfUrl(
  sessionId: string,
  token: string,
): Promise<string> {
  const res = await fetch(
    `${demoApiBase()}/demo/sessions/${sessionId}/file?format=json`,
    {
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/json",
      },
    },
  );
  const data = await parseJson(res);
  if (!res.ok || !data.url) {
    throw new Error(data.error || "Could not load the PDF");
  }
  return data.url as string;
}

export async function fetchDemoThumbnail(
  sessionId: string,
  token: string,
  page: number,
): Promise<string> {
  const q = new URLSearchParams({ width: "160" });
  const res = await fetch(
    `${demoApiBase()}/demo/sessions/${sessionId}/pages/${page}/thumbnail.jpg?${q}`,
    { headers: { Authorization: `Bearer ${token}` } },
  );
  if (!res.ok) {
    throw new Error(`Thumbnail fetch failed: ${res.status}`);
  }
  const type = res.headers.get("content-type") || "";
  if (!type.includes("image/")) {
    throw new Error("Thumbnail was not an image");
  }
  const blob = await res.blob();
  if (blob.size < 32) {
    throw new Error("Thumbnail was empty");
  }
  return URL.createObjectURL(blob);
}

export async function submitDemoLead(
  sessionId: string,
  token: string,
  email: string,
  intent: "download" | "quote" = "download",
) {
  const res = await fetch(`${demoApiBase()}/demo/sessions/${sessionId}/lead`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ email, intent }),
  });
  const data = await parseJson(res);
  if (!res.ok || !data.success) {
    const err = new Error(data.error || "Could not send the download link") as Error & {
      devDownloadUrl?: string;
    };
    if (typeof data.devDownloadUrl === "string") err.devDownloadUrl = data.devDownloadUrl;
    throw err;
  }
  return data as {
    success: true;
    email: string;
    emailed: boolean;
    devDownloadUrl?: string;
  };
}

export async function downloadDemoExcelByToken(
  sessionId: string,
  downloadToken: string,
) {
  const q = new URLSearchParams({ download_token: downloadToken });
  const res = await fetch(
    `${demoApiBase()}/demo/sessions/${sessionId}/export?${q}`,
  );
  if (!res.ok) {
    const data = await parseJson(res).catch(() => ({}));
    throw new Error((data as { error?: string }).error || "Download failed");
  }
  const blob = await res.blob();
  const dispo = res.headers.get("Content-Disposition") || "";
  const match = /filename="([^"]+)"/.exec(dispo);
  const name = match?.[1] || "extract.xlsx";
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
