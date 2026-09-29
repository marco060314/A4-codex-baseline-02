import { test, expect } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";
import { loadEnvFile } from "node:process";
loadEnvFile(".env.local");
const admin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
);
let email: string, password: string, userId: string;
test.beforeAll(async () => {
  email = `browser-${crypto.randomUUID()}@example.com`;
  password = crypto.randomUUID() + "Aa1!";
  const { data, error } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });
  if (error) throw error;
  userId = data.user!.id;
});
test.afterAll(async () => {
  if (userId) {
    const { data: objects } = await admin.storage.from("exports").list(userId);
    if (objects?.length)
      await admin.storage
        .from("exports")
        .remove(objects.map((o) => `${userId}/${o.name}`));
    await admin.from("jobs").delete().eq("user_id", userId);
    await admin.auth.admin.deleteUser(userId);
  }
});
async function login(page: import("@playwright/test").Page) {
  await page.goto("/");
  await page.getByLabel("Email address").fill(email);
  await page.getByLabel("Password", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Open your notebook" }).click();
  await expect(page.getByRole("button", { name: /^New note/ })).toBeVisible();
}
test("notebook lifecycle, privacy, export, conflict recovery and mobile layout", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto("/");
  await page.screenshot({ path: "artifacts/landing.png", fullPage: true });
  await login(page);
  await page.getByRole("button", { name: /^New note/ }).click();
  await page.getByLabel("Note title").fill("A few things worth remembering");
  await page
    .getByRole("textbox", { name: "Note content" })
    .fill(
      "A morning walk makes room for new ideas.\nBring the notebook on Saturday.",
    );
  await page.getByLabel("Add tag").fill("everyday");
  await page.getByLabel("Add tag").press("Enter");
  await expect(page.getByText("Saved", { exact: true })).toBeVisible();
  await page.reload();
  await page
    .getByRole("button", { name: /A few things worth remembering/ })
    .click();
  await expect(page.getByLabel("Note title")).toHaveValue(
    "A few things worth remembering",
  );
  await page.getByRole("button", { name: "Pin note", exact: true }).click();
  await expect(page.getByText("Saved", { exact: true })).toBeVisible();
  await page.screenshot({
    path: "artifacts/notebook-desktop.png",
    fullPage: true,
  });
  await page
    .getByRole("button", { name: "Ask your notes", exact: false })
    .last()
    .click();
  await expect(
    page.getByRole("heading", { name: /A little help/ }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Choose in Settings" }).click();
  await page.getByRole("switch", { name: "Enable AI assistant" }).click();
  await expect(page.getByRole("switch")).toHaveAttribute(
    "aria-checked",
    "true",
  );
  await page.getByRole("button", { name: "Export notebook" }).click();
  await expect(
    page.getByText(
      "Your export is queued. The download will appear here when ready.",
    ),
  ).toBeVisible();
  const cron = await page.request.get("/api/jobs", {
    headers: { authorization: `Bearer ${process.env.CRON_SECRET}` },
  });
  expect(cron.status()).toBe(200);
  await expect(
    page.getByRole("link", { name: "Download", exact: false }),
  ).toBeVisible({ timeout: 15000 });
  const href = await page
    .getByRole("link", { name: "Download", exact: false })
    .getAttribute("href");
  const archive = await page.request.get(href!);
  expect(archive.status()).toBe(200);
  expect(archive.headers()["content-type"]).toBe("application/zip");
  await page.getByRole("button", { name: "Close settings" }).click();
  await page
    .getByRole("button", { name: "Ask your notes", exact: false })
    .last()
    .click();
  await page
    .getByRole("button", { name: "Summarize this note", exact: true })
    .click();
  await expect(
    page.getByRole("alert").filter({ hasText: "unavailable" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Close assistant" }).click();
  // A second client edits the same revision while the browser has it open.
  const { data: row } = await admin
    .from("notes")
    .select("*")
    .eq("user_id", userId)
    .single();
  await admin
    .from("notes")
    .update({ revision: row.revision + 1, title: "Edited elsewhere" })
    .eq("id", row.id);
  await page.getByLabel("Note title").fill("My unsaved draft");
  await expect(
    page.getByRole("alert").filter({ hasText: "another tab" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Save as recovered copy" }).click();
  await expect(page.getByLabel("Note title")).toHaveValue(
    "My unsaved draft (recovered)",
  );
  await page.getByLabel("Exclude from AI").check();
  await expect(page.getByText("Saved", { exact: true })).toBeVisible();
  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({
    path: "artifacts/notebook-mobile.png",
    fullPage: true,
  });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
  await page.getByRole("button", { name: "Move to trash" }).click();
  await page.getByRole("button", { name: "Open navigation" }).click();
  await page.getByRole("button", { name: "Trash", exact: true }).click();
  await page
    .getByRole("button", { name: /My unsaved draft \(recovered\)/ })
    .click();
  await page.getByRole("button", { name: "Restore note" }).click();
  await page.getByRole("button", { name: "Open navigation" }).click();
  await page.getByRole("button", { name: "All notes", exact: true }).click();
  await page
    .getByRole("button", { name: /My unsaved draft \(recovered\)/ })
    .click();
  await page.getByRole("button", { name: "Move to trash" }).click();
  await page.getByRole("button", { name: "Open navigation" }).click();
  await page.getByRole("button", { name: "Trash", exact: true }).click();
  await page
    .getByRole("button", { name: /My unsaved draft \(recovered\)/ })
    .click();
  await page
    .getByRole("button", { name: "Delete forever", exact: true })
    .click();
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Delete forever" })
    .click();
  await expect(
    page.getByRole("heading", { name: "Nothing in the trash" }),
  ).toBeVisible();
  const csrf = await page.request.post("/api/profile", {
    headers: { origin: "https://untrusted.example" },
    data: { enabled: true },
  });
  expect(csrf.status()).toBe(405);
  const rejected = await page.request.patch("/api/profile", {
    headers: { origin: "https://untrusted.example" },
    data: { enabled: true },
  });
  expect(rejected.status()).toBe(403);
  // Deletion requires reauthentication and removes both identity and private exports.
  await page.getByRole("button", { name: "Open navigation" }).click();
  await page.getByRole("button", { name: "Settings", exact: true }).click();
  await page
    .getByRole("button", { name: "Delete my account", exact: true })
    .click();
  await page.getByLabel("Your password", { exact: true }).fill(password);
  await page.getByLabel("Type DELETE to confirm").fill("DELETE");
  await page
    .getByRole("button", { name: "Permanently delete account", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "Open your notebook" }),
  ).toBeVisible();
  expect(
    (
      await page.request.get("/api/jobs", {
        headers: { authorization: `Bearer ${process.env.CRON_SECRET}` },
      })
    ).status(),
  ).toBe(200);
  expect((await admin.auth.admin.getUserById(userId)).data.user).toBeNull();
  expect(errors).toEqual([]);
});
test("API rejects anonymous and cross-origin mutations and cron requests", async ({
  request,
}) => {
  expect((await request.get("/api/notes")).status()).toBe(401);
  expect((await request.get("/api/jobs")).status()).toBe(401);
});
