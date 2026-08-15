import { expect, test } from "@playwright/test";

/**
 * Step 1 authentication smoke tests.
 *
 * Requires a running app and a seeded database:
 *   npm run seed && npm run build && npm run start
 *   npx playwright test
 */

test("anonymous API access is rejected", async ({ request }) => {
  const response = await request.get("/api/questions");
  expect(response.status()).toBe(401);

  const body = await response.json();
  expect(body.success).toBe(false);
  expect(body.error.code).toBe("UNAUTHORIZED");
});

test("the dashboard redirects an anonymous visitor to sign in", async ({ page }) => {
  await page.goto("/dashboard");
  await expect(page).toHaveURL(/\/login/);
});

test("a bad password shows a generic error", async ({ page }) => {
  await page.goto("/login");
  await page.getByLabel("Email").fill("teacher@autoqgen.local");
  await page.getByLabel("Password").fill("definitely-the-wrong-password");
  await page.getByRole("button", { name: "Sign in" }).click();

  // Identical to the message shown for an account that does not exist.
  await expect(page.getByRole("alert")).toContainText("Invalid email or password");
});

test("a seeded teacher can sign in and reach the dashboard", async ({ page }) => {
  await page.goto("/login");
  await page.getByLabel("Email").fill("teacher@autoqgen.local");
  await page.getByLabel("Password").fill(process.env.SEED_PASSWORD ?? "DevPassword123!");
  await page.getByRole("button", { name: "Sign in" }).click();

  await expect(page).toHaveURL(/\/dashboard/);
  await expect(page.getByRole("heading", { level: 1 })).toContainText("Welcome back");
});

test("the forgot-password response is identical for known and unknown emails", async ({
  request,
}) => {
  const known = await request.post("/api/auth/forgot-password", {
    data: { email: "teacher@autoqgen.local" },
  });
  const unknown = await request.post("/api/auth/forgot-password", {
    data: { email: "nobody-here@example.com" },
  });

  expect(known.status()).toBe(unknown.status());
  expect((await known.json()).data.message).toBe((await unknown.json()).data.message);
});
