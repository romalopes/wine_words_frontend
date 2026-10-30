import type { APIRequestContext } from "@playwright/test";

export function uniqueName(prefix: string): string {
  return `${prefix} ${Date.now()} ${Math.random().toString(36).slice(2, 8)}`;
}

export async function signInApi(api: APIRequestContext, email: string, password: string): Promise<string> {
  const response = await api.post("auth/sign_in", { data: { user: { email, password } } });
  if (!response.ok()) throw new Error(`API sign-in failed: ${response.status()} ${await response.text()}`);
  return response.headers()["authorization"]?.replace(/^Bearer\s+/i, "") ?? "";
}

export async function createProducer(api: APIRequestContext, token: string, name = uniqueName("E2E Producer")) {
  const countries = await api.get("countries");
  const countryList = (await countries.json()) as Array<{ id: number; code: string }>;
  const country = countryList.find((item) => item.code === "AU") ?? countryList[0];
  if (!country) throw new Error("No country is available for producer creation");
  const response = await api.post("producers", {
    headers: { Authorization: `Bearer ${token}` },
    data: {
      producer: {
        name,
        email: `${name.toLowerCase().replace(/\W+/g, "-").replace(/^-|-$/g, "")}@example.test`,
        producer_type: "winery",
        country_id: country.id,
      },
    },
  });
  if (!response.ok()) throw new Error(`Producer creation failed: ${response.status()} ${await response.text()}`);
  return response.json() as Promise<{ id: number; name: string; slug: string }>;
}