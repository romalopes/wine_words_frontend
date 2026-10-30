import { expect, request, test as setup } from "@playwright/test";
import fs from "node:fs/promises";
import path from "node:path";
import {
  accounts,
  apiUrl,
  frontendUrl,
  testAccessPassword,
  userPassword,
} from "./support/environment";

setup("create role-aware browser states", async () => {
  const accessApi = await request.newContext({ baseURL: `${apiUrl}/` });
  const accessResponse = await accessApi.post("test_access", {
    data: { password: testAccessPassword },
  });
  expect(accessResponse.ok()).toBeTruthy();
  const access = (await accessResponse.json()) as { token: string };

  await fs.mkdir(path.resolve(".auth"), { recursive: true });
  await fs.writeFile(
    path.resolve(".auth/test-access.json"),
    JSON.stringify(access),
  );

  for (const [role, email] of Object.entries(accounts)) {
    const roleApi = await request.newContext({
      baseURL: `${apiUrl}/`,
      extraHTTPHeaders: { "X-Test-Access-Token": access.token },
    });
    const response = await roleApi.post("auth/sign_in", {
      data: { user: { email, password: userPassword } },
    });
    expect(
      response.ok(),
      `${role} sign-in failed: ${await response.text()}`,
    ).toBeTruthy();
    const authorization = response.headers()["authorization"];
    expect(authorization).toBeTruthy();
    if (!authorization)
      throw new Error(`${role} sign-in returned no Authorization header`);
    const token = authorization.replace(/^Bearer\s+/i, "");
    await fs.writeFile(
      path.resolve(`.auth/${role}.json`),
      JSON.stringify({
        cookies: [],
        origins: [
          {
            origin: frontendUrl,
            localStorage: [{ name: "wine_words_token", value: token }],
          },
        ],
      }),
    );
    await roleApi.dispose();
  }
  await accessApi.dispose();
});
