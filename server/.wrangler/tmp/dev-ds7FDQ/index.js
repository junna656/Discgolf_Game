var __defProp = Object.defineProperty;
var __name = (target, value) => __defProp(target, "name", { value, configurable: true });

// .wrangler/tmp/bundle-hwJdTj/strip-cf-connecting-ip-header.js
function stripCfConnectingIPHeader(input, init) {
  const request = new Request(input, init);
  request.headers.delete("CF-Connecting-IP");
  return request;
}
__name(stripCfConnectingIPHeader, "stripCfConnectingIPHeader");
globalThis.fetch = new Proxy(globalThis.fetch, {
  apply(target, thisArg, argArray) {
    return Reflect.apply(target, thisArg, [
      stripCfConnectingIPHeader.apply(null, argArray)
    ]);
  }
});

// src/index.js
var MAX = 4;
var CODE = /^[A-Z]{4}$/;
var LEBENSDAUER = 6 * 3600 * 1e3;
var src_default = {
  async fetch(req, env) {
    const url = new URL(req.url);
    const herkunft = req.headers.get("Origin") || "";
    const erlaubt = (env.ERLAUBT || "").split(",").map((s) => s.trim()).filter(Boolean);
    if (herkunft && erlaubt.length && !erlaubt.includes(herkunft))
      return new Response("Herkunft nicht erlaubt", { status: 403 });
    if (url.pathname === "/" || url.pathname === "/status")
      return new Response("Boogie Garanten Multiplayer l\xE4uft", { headers: { "content-type": "text/plain; charset=utf-8" } });
    const m = url.pathname.match(/^\/raum\/([A-Za-z]{4})$/);
    if (!m)
      return new Response("Nicht gefunden", { status: 404 });
    if (req.headers.get("Upgrade") !== "websocket")
      return new Response("WebSocket erwartet", { status: 426 });
    const code = m[1].toUpperCase();
    return env.RAUM.get(env.RAUM.idFromName(code)).fetch(req);
  }
};
var Raum = class {
  constructor(ctx, env) {
    this.ctx = ctx;
    this.env = env;
  }
  async daten() {
    if (!this._d)
      this._d = await this.ctx.storage.get("raum") || null;
    return this._d;
  }
  async speichere(d) {
    this._d = d;
    await this.ctx.storage.put("raum", d);
    await this.ctx.storage.setAlarm(Date.now() + LEBENSDAUER);
  }
  async fetch(req) {
    const url = new URL(req.url);
    const code = url.pathname.slice(-4).toUpperCase();
    const id = (url.searchParams.get("id") || "").slice(0, 40);
    const name = (url.searchParams.get("name") || "Gast").slice(0, 20);
    const neu = url.searchParams.get("neu") === "1";
    if (!/^[A-Za-z0-9_-]{6,40}$/.test(id) || !CODE.test(code))
      return new Response("Ung\xFCltig", { status: 400 });
    const paar = new WebSocketPair();
    const [client, server] = Object.values(paar);
    this.ctx.acceptWebSocket(server, [id]);
    let d = await this.daten();
    const fehler = /* @__PURE__ */ __name((text) => {
      server.send(JSON.stringify({ typ: "fehler", text }));
      server.close(4e3, text);
      return new Response(null, { status: 101, webSocket: client });
    }, "fehler");
    if (neu) {
      if (d && d.mitglieder.some((x) => this.online(x.id)))
        return fehler("belegt");
      d = { code, host: id, mitglieder: [], start: null, stand: null };
    } else if (!d) {
      return fehler("Raum nicht gefunden");
    }
    let mitglied = d.mitglieder.find((x) => x.id === id);
    if (!mitglied) {
      if (d.mitglieder.length >= MAX)
        return fehler("Raum ist voll (4 Spieler)");
      if (d.start && !d.start.offen)
        return fehler("Spiel l\xE4uft schon");
      mitglied = { id, name, platz: null };
      d.mitglieder.push(mitglied);
    } else
      mitglied.name = name;
    if (!d.mitglieder.some((x) => x.id === d.host) || !this.online(d.host, server)) {
      if (!this.online(d.host, server))
        d.host = id;
    }
    await this.speichere(d);
    this.sendeRaum(d);
    return new Response(null, { status: 101, webSocket: client });
  }
  // ist das Gerät verbunden? (ohne den gerade neuen Socket)
  online(id, ausser) {
    return this.ctx.getWebSockets(id).some((ws) => ws !== ausser && ws.readyState === 1);
  }
  sendeRaum(d) {
    const msg = JSON.stringify({
      typ: "raum",
      code: d.code,
      host: d.host,
      mitglieder: d.mitglieder.map((x) => ({ ...x, online: this.ctx.getWebSockets(x.id).length > 0 })),
      start: d.start,
      stand: d.stand
    });
    for (const ws of this.ctx.getWebSockets()) {
      try {
        ws.send(msg);
      } catch (e) {
      }
    }
  }
  async webSocketMessage(ws, roh) {
    if (typeof roh !== "string" || roh.length > 2e5)
      return;
    let m;
    try {
      m = JSON.parse(roh);
    } catch (e) {
      return;
    }
    const [id] = this.ctx.getTags(ws);
    const d = await this.daten();
    if (!d)
      return;
    const ich = d.mitglieder.find((x) => x.id === id);
    if (!ich)
      return;
    if (m.typ === "ping") {
      ws.send('{"typ":"pong"}');
      return;
    }
    if (m.typ === "platz") {
      const p = typeof m.platz === "string" ? m.platz.slice(0, 20) : null;
      if (p && d.mitglieder.some((x) => x.platz === p && x.id !== id))
        return;
      ich.platz = p;
      ich.tasche = p && Array.isArray(m.tasche) ? m.tasche.slice(0, 30) : null;
      ich.lieblingsscheibe = p && typeof m.lieblingsscheibe === "string" ? m.lieblingsscheibe.slice(0, 30) : null;
      await this.speichere(d);
      this.sendeRaum(d);
      return;
    }
    if (m.typ === "raus") {
      d.mitglieder = d.mitglieder.filter((x) => x.id !== id);
      if (d.host === id && d.mitglieder.length)
        d.host = d.mitglieder[0].id;
      await this.speichere(d);
      this.sendeRaum(d);
      try {
        ws.close(1e3, "raus");
      } catch (e) {
      }
      return;
    }
    if (m.typ === "start" || m.typ === "lobby") {
      if (id !== d.host)
        return;
      d.start = m.typ === "start" ? m.start : null;
      d.stand = null;
      await this.speichere(d);
      this.sendeRaum(d);
      return;
    }
    if (m.stand) {
      d.stand = m.stand;
      await this.speichere(d);
    }
    m.von = id;
    const text = JSON.stringify(m);
    for (const andere of this.ctx.getWebSockets())
      if (andere !== ws) {
        try {
          andere.send(text);
        } catch (e) {
        }
      }
  }
  async webSocketClose(ws) {
    const d = await this.daten();
    if (!d)
      return;
    const [id] = this.ctx.getTags(ws);
    if (d.host === id && !this.online(id, ws)) {
      const neuerHost = d.mitglieder.find((x) => x.id !== id && this.online(x.id, ws));
      if (neuerHost) {
        d.host = neuerHost.id;
        await this.speichere(d);
      }
    }
    this.sendeRaumOhne(d, ws);
  }
  async webSocketError(ws) {
    await this.webSocketClose(ws);
  }
  sendeRaumOhne(d, weg) {
    const msg = JSON.stringify({
      typ: "raum",
      code: d.code,
      host: d.host,
      mitglieder: d.mitglieder.map((x) => ({ ...x, online: this.ctx.getWebSockets(x.id).some((w) => w !== weg) })),
      start: d.start,
      stand: d.stand
    });
    for (const ws of this.ctx.getWebSockets())
      if (ws !== weg) {
        try {
          ws.send(msg);
        } catch (e) {
        }
      }
  }
  async alarm() {
    await this.ctx.storage.deleteAll();
    this._d = null;
  }
};
__name(Raum, "Raum");

// ../../../../tmp/wr/node_modules/wrangler/templates/middleware/middleware-ensure-req-body-drained.ts
var drainBody = /* @__PURE__ */ __name(async (request, env, _ctx, middlewareCtx) => {
  try {
    return await middlewareCtx.next(request, env);
  } finally {
    try {
      if (request.body !== null && !request.bodyUsed) {
        const reader = request.body.getReader();
        while (!(await reader.read()).done) {
        }
      }
    } catch (e) {
      console.error("Failed to drain the unused request body.", e);
    }
  }
}, "drainBody");
var middleware_ensure_req_body_drained_default = drainBody;

// ../../../../tmp/wr/node_modules/wrangler/templates/middleware/middleware-miniflare3-json-error.ts
function reduceError(e) {
  return {
    name: e?.name,
    message: e?.message ?? String(e),
    stack: e?.stack,
    cause: e?.cause === void 0 ? void 0 : reduceError(e.cause)
  };
}
__name(reduceError, "reduceError");
var jsonError = /* @__PURE__ */ __name(async (request, env, _ctx, middlewareCtx) => {
  try {
    return await middlewareCtx.next(request, env);
  } catch (e) {
    const error = reduceError(e);
    return Response.json(error, {
      status: 500,
      headers: { "MF-Experimental-Error-Stack": "true" }
    });
  }
}, "jsonError");
var middleware_miniflare3_json_error_default = jsonError;

// .wrangler/tmp/bundle-hwJdTj/middleware-insertion-facade.js
var __INTERNAL_WRANGLER_MIDDLEWARE__ = [
  middleware_ensure_req_body_drained_default,
  middleware_miniflare3_json_error_default
];
var middleware_insertion_facade_default = src_default;

// ../../../../tmp/wr/node_modules/wrangler/templates/middleware/common.ts
var __facade_middleware__ = [];
function __facade_register__(...args) {
  __facade_middleware__.push(...args.flat());
}
__name(__facade_register__, "__facade_register__");
function __facade_invokeChain__(request, env, ctx, dispatch, middlewareChain) {
  const [head, ...tail] = middlewareChain;
  const middlewareCtx = {
    dispatch,
    next(newRequest, newEnv) {
      return __facade_invokeChain__(newRequest, newEnv, ctx, dispatch, tail);
    }
  };
  return head(request, env, ctx, middlewareCtx);
}
__name(__facade_invokeChain__, "__facade_invokeChain__");
function __facade_invoke__(request, env, ctx, dispatch, finalMiddleware) {
  return __facade_invokeChain__(request, env, ctx, dispatch, [
    ...__facade_middleware__,
    finalMiddleware
  ]);
}
__name(__facade_invoke__, "__facade_invoke__");

// .wrangler/tmp/bundle-hwJdTj/middleware-loader.entry.ts
var __Facade_ScheduledController__ = class {
  constructor(scheduledTime, cron, noRetry) {
    this.scheduledTime = scheduledTime;
    this.cron = cron;
    this.#noRetry = noRetry;
  }
  #noRetry;
  noRetry() {
    if (!(this instanceof __Facade_ScheduledController__)) {
      throw new TypeError("Illegal invocation");
    }
    this.#noRetry();
  }
};
__name(__Facade_ScheduledController__, "__Facade_ScheduledController__");
function wrapExportedHandler(worker) {
  if (__INTERNAL_WRANGLER_MIDDLEWARE__ === void 0 || __INTERNAL_WRANGLER_MIDDLEWARE__.length === 0) {
    return worker;
  }
  for (const middleware of __INTERNAL_WRANGLER_MIDDLEWARE__) {
    __facade_register__(middleware);
  }
  const fetchDispatcher = /* @__PURE__ */ __name(function(request, env, ctx) {
    if (worker.fetch === void 0) {
      throw new Error("Handler does not export a fetch() function.");
    }
    return worker.fetch(request, env, ctx);
  }, "fetchDispatcher");
  return {
    ...worker,
    fetch(request, env, ctx) {
      const dispatcher = /* @__PURE__ */ __name(function(type, init) {
        if (type === "scheduled" && worker.scheduled !== void 0) {
          const controller = new __Facade_ScheduledController__(
            Date.now(),
            init.cron ?? "",
            () => {
            }
          );
          return worker.scheduled(controller, env, ctx);
        }
      }, "dispatcher");
      return __facade_invoke__(request, env, ctx, dispatcher, fetchDispatcher);
    }
  };
}
__name(wrapExportedHandler, "wrapExportedHandler");
function wrapWorkerEntrypoint(klass) {
  if (__INTERNAL_WRANGLER_MIDDLEWARE__ === void 0 || __INTERNAL_WRANGLER_MIDDLEWARE__.length === 0) {
    return klass;
  }
  for (const middleware of __INTERNAL_WRANGLER_MIDDLEWARE__) {
    __facade_register__(middleware);
  }
  return class extends klass {
    #fetchDispatcher = (request, env, ctx) => {
      this.env = env;
      this.ctx = ctx;
      if (super.fetch === void 0) {
        throw new Error("Entrypoint class does not define a fetch() function.");
      }
      return super.fetch(request);
    };
    #dispatcher = (type, init) => {
      if (type === "scheduled" && super.scheduled !== void 0) {
        const controller = new __Facade_ScheduledController__(
          Date.now(),
          init.cron ?? "",
          () => {
          }
        );
        return super.scheduled(controller);
      }
    };
    fetch(request) {
      return __facade_invoke__(
        request,
        this.env,
        this.ctx,
        this.#dispatcher,
        this.#fetchDispatcher
      );
    }
  };
}
__name(wrapWorkerEntrypoint, "wrapWorkerEntrypoint");
var WRAPPED_ENTRY;
if (typeof middleware_insertion_facade_default === "object") {
  WRAPPED_ENTRY = wrapExportedHandler(middleware_insertion_facade_default);
} else if (typeof middleware_insertion_facade_default === "function") {
  WRAPPED_ENTRY = wrapWorkerEntrypoint(middleware_insertion_facade_default);
}
var middleware_loader_entry_default = WRAPPED_ENTRY;
export {
  Raum,
  __INTERNAL_WRANGLER_MIDDLEWARE__,
  middleware_loader_entry_default as default
};
//# sourceMappingURL=index.js.map
