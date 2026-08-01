function normalizeEmail(value) {
  return String(value || "").trim().toLowerCase();
}

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "content-type": "application/json; charset=UTF-8",
      "cache-control": "no-store",
    },
  });
}

export async function onRequestGet(context) {
  const configuredAdmin = normalizeEmail(context.env.ADMIN_EMAIL);
  const accessEmail = normalizeEmail(
    context.request.headers.get("Cf-Access-Authenticated-User-Email"),
  );

  if (!configuredAdmin) {
    return json({ ok: false, error: "ADMIN_EMAIL_NOT_CONFIGURED" }, 503);
  }
  if (!accessEmail) {
    return json({ ok: false, error: "ACCESS_LOGIN_REQUIRED" }, 401);
  }
  if (accessEmail !== configuredAdmin) {
    return json({ ok: false, error: "FORBIDDEN" }, 403);
  }

  return json({
    ok: true,
    admin: { email: accessEmail },
    database: { binding: "TOYSKUB_DB", connected: Boolean(context.env.TOYSKUB_DB) },
    phase: 1,
  });
}
