const CODEX_TASK_KEY_DOMAIN = "buzz:codex-task:v1:";

/** Stable public digest for recognizing one Codex task across owner devices. */
export async function codexTaskKey(taskId: string): Promise<string> {
  const normalized = taskId.trim().toLocaleLowerCase();
  const digest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(`${CODEX_TASK_KEY_DOMAIN}${normalized}`),
  );
  return Array.from(new Uint8Array(digest), (byte) =>
    byte.toString(16).padStart(2, "0"),
  ).join("");
}
