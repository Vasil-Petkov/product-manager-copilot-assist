import assert from "node:assert/strict";
import { once } from "node:events";
import { test } from "node:test";
import express, { type Response } from "express";
import * as oidc from "openid-client";
import {
  getSafeReturnTo,
  getTrustedAppOrigin,
  redirectToLocalPath,
  redirectToOidcEndpoint,
} from "../lib/auth-redirects.ts";
import { parseRouteInteger } from "../lib/route-params.ts";

test("return paths reject external, backslash, encoded and normalized redirect bypasses", () => {
  const hostile: unknown[] = [
    undefined, null, {}, ["/"], "", "https://evil.invalid", "//evil.invalid",
    "///evil.invalid", "/\\evil.invalid", "/%5cevil.invalid", "/%2fevil.invalid",
    "/%2f%2fevil.invalid", "/a/..//evil.invalid", "/%2e%2e//evil.invalid",
    "/\tevil.invalid", "/%0d%0aLocation:evil", "/%zz",
  ];
  for (const value of hostile) {
    assert.equal(getSafeReturnTo(value), "/", String(value));
  }
  for (const path of ["/", "/pm-copilot/", "/ideas/12?tab=details#notes", "/search?q=https://example.com"]) {
    assert.equal(getSafeReturnTo(path), path);
  }
});

test("authentication origins require an exact provisioned host and HTTPS", () => {
  assert.equal(getTrustedAppOrigin("APP.EXAMPLE.COM", ["app.example.com"]), "https://app.example.com");
  for (const host of [
    "evil.invalid", "app.example.com.evil.invalid", "app.example.com@evil.invalid",
    "app.example.com,evil.invalid", "app.example.com/path", ["app.example.com"],
    "app.example.com:443", undefined,
  ]) {
    assert.throws(() => getTrustedAppOrigin(host, ["app.example.com"]));
  }
});

test("OIDC redirects retain library parameters but enforce the discovered HTTPS endpoint", () => {
  const config = new oidc.Configuration({
    issuer: "https://identity.example.com",
    authorization_endpoint: "https://identity.example.com/authorize",
    end_session_endpoint: "https://identity.example.com/logout",
  }, "test-client");
  let location = "";
  const res = { redirect: (value: string) => { location = value; } } as Response;
  const login = oidc.buildAuthorizationUrl(config, {
    redirect_uri: "https://app.example.com/api/callback",
    state: "test-state", code_challenge: "test-challenge", code_challenge_method: "S256",
  });
  redirectToOidcEndpoint(res, login, config.serverMetadata().authorization_endpoint);
  assert.equal(new URL(location).searchParams.get("state"), "test-state");
  assert.equal(new URL(location).searchParams.get("redirect_uri"), "https://app.example.com/api/callback");
  const logout = oidc.buildEndSessionUrl(config, {
    post_logout_redirect_uri: "https://app.example.com/pm-copilot/",
  });
  redirectToOidcEndpoint(res, logout, config.serverMetadata().end_session_endpoint);
  assert.equal(new URL(location).searchParams.get("post_logout_redirect_uri"), "https://app.example.com/pm-copilot/");
  for (const target of [
    "https://evil.invalid/authorize", "http://identity.example.com/authorize",
    "https://identity.example.com/wrong", "https://user@identity.example.com/authorize",
    "https://identity.example.com/authorize#fragment",
    "https://identity.example.com.evil.invalid/authorize",
    "https://identity.example.com/authorize/extra",
    "https://identity.example.com/%2fauthorize",
  ]) {
    assert.throws(() => redirectToOidcEndpoint(res, new URL(target), config.serverMetadata().authorization_endpoint));
  }
  assert.throws(() => redirectToOidcEndpoint(res, login, undefined));
  assert.throws(() => redirectToOidcEndpoint(res, new URL("http://identity.example.com/authorize"), "http://identity.example.com/authorize"));
  // Never forward a caller-controlled href, even when the other URL properties
  // appear valid. Build the destination's authority/path from discovery.
  Object.defineProperty(login, "href", { value: "https://evil.invalid/phishing" });
  redirectToOidcEndpoint(res, login, config.serverMetadata().authorization_endpoint);
  assert.equal(new URL(location).origin, "https://identity.example.com");
  assert.equal(new URL(location).pathname, "/authorize");
});

test("HTTP redirect Location stays same-origin for attacker-controlled return paths", async () => {
  const app = express();
  app.get("/", (req, res) => redirectToLocalPath(res, req.query.returnTo));
  const server = app.listen(0, "127.0.0.1");
  await once(server, "listening");
  const address = server.address();
  assert.ok(address && typeof address !== "string");
  const origin = `http://127.0.0.1:${address.port}`;
  try {
    for (const value of ["//evil.invalid", "/\\evil.invalid", "/a/..//evil.invalid", "/pm-copilot/?tab=1"]) {
      const response = await fetch(`${origin}/?returnTo=${encodeURIComponent(value)}`, { redirect: "manual" });
      assert.equal(response.status, 302);
      const location = response.headers.get("location");
      assert.ok(location);
      assert.equal(new URL(location, origin).origin, origin);
      assert.equal(location, value.startsWith("/pm-copilot/") ? value : "/");
      await response.text();
    }
  } finally {
    await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
  }
});

test("Express route IDs reject array parameters rather than coercing them to an ID", () => {
  assert.equal(parseRouteInteger("12"), 12);
  assert.ok(Number.isNaN(parseRouteInteger(["12", "34"])));
  assert.ok(Number.isNaN(parseRouteInteger(undefined)));
  assert.ok(Number.isNaN(parseRouteInteger("invalid")));
});
