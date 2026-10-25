import assert from "node:assert/strict";
import { once } from "node:events";
import { test } from "node:test";
import { gzipSync } from "node:zlib";
import express, { type ErrorRequestHandler, type Request, type Response } from "express";
import { z, ZodError } from "zod";
import {
  CreateOpportunityBody,
  CreateValidationHypothesisBody,
  ListOpportunitiesQueryParams,
} from "../../../../lib/api-zod/src/generated/api.ts";
import { validate } from "../middlewares/validate.ts";

test("generated API schemas preserve coercion, optional fields, and validation errors on Zod 4", () => {
  assert.deepEqual(
    ListOpportunitiesQueryParams.parse({ limit: "25", offset: "0" }),
    { limit: 25, offset: 0 },
  );
  assert.equal(ListOpportunitiesQueryParams.safeParse({ limit: "201" }).success, false);

  const idea = {
    title: "Test idea",
    description: "Description",
    sourceType: "manual",
  };
  assert.deepEqual(CreateOpportunityBody.parse({ ...idea, unexpected: true }), idea);
  assert.equal(CreateOpportunityBody.safeParse({ ...idea, title: "" }).success, false);

  const hypothesis = {
    opportunityId: 1,
    hypothesisType: "problem",
    statement: "Users need a clearer workflow",
    status: "draft",
    assumption: null,
  };
  assert.deepEqual(CreateValidationHypothesisBody.parse(hypothesis), hypothesis);
  const invalid = CreateValidationHypothesisBody.safeParse({ ...hypothesis, status: "invalid" });
  assert.equal(invalid.success, false);
  if (!invalid.success) {
    assert.ok(invalid.error instanceof ZodError);
    assert.deepEqual(invalid.error.issues[0].path, ["status"]);
  }
});

test("request validation still replaces parsed bodies and forwards structured errors", () => {
  const schema = z.object({ id: z.coerce.number().int().positive() });
  const middleware = validate(schema);
  const req = { body: { id: "12", unexpected: true } } as Request;
  let calls = 0;
  middleware(req, {} as Response, (error) => {
    assert.equal(error, undefined);
    calls += 1;
  });
  assert.equal(calls, 1);
  assert.deepEqual(req.body, { id: 12 });

  middleware({ body: { id: "invalid" } } as Request, {} as Response, (error) => {
    assert.ok(error instanceof ZodError);
    assert.deepEqual(error.issues[0].path, ["id"]);
    calls += 1;
  });
  assert.equal(calls, 2);
});

test("compressed bodies with trailing bytes do not crash Express", async () => {
  const app = express();
  app.use(express.json());
  app.post("/", (req, res) => res.json(req.body));
  const handleError: ErrorRequestHandler = (_error, _req, res, _next) => {
    res.status(400).json({ error: "Invalid body" });
  };
  app.use(handleError);
  const server = app.listen(0, "127.0.0.1");
  await once(server, "listening");
  const address = server.address();
  assert.ok(address && typeof address !== "string");
  const url = `http://127.0.0.1:${address.port}/`;
  try {
    const hostileBody = Buffer.concat([
      gzipSync(JSON.stringify({ ok: true })),
      Buffer.from("trailing invalid compressed data"),
    ]);
    const hostile = await fetch(url, {
      method: "POST",
      headers: { "content-type": "application/json", "content-encoding": "gzip" },
      body: hostileBody,
    });
    assert.ok([200, 400].includes(hostile.status));
    await hostile.text();
    const valid = await fetch(url, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ ok: true }),
    });
    assert.equal(valid.status, 200);
    assert.deepEqual(await valid.json(), { ok: true });
  } finally {
    await new Promise<void>((resolve, reject) => {
      server.close((error) => error ? reject(error) : resolve());
      server.closeAllConnections();
    });
  }
});
