function normalizeEmail(value) {
  return String(value || "").trim().toLowerCase();
}

function deny(message, status = 403) {
  return new Response(
    `<!doctype html><html lang="th"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>TOYSKUB Admin</title><style>body{margin:0;min-height:100vh;display:grid;place-items:center;background:#edeef0;color:#14181f;font-family:system-ui,sans-serif}.box{max-width:560px;margin:24px;padding:28px;border:2px solid #14181f;background:#fff}.code{font-family:monospace;color:#2b4c7e}.btn{display:inline-block;margin-top:16px;padding:10px 14px;border:1px solid #14181f;text-decoration:none;color:inherit}</style></head><body><main class="box"><div class="code">TOYSKUB / ADMIN</div><h1>ไม่สามารถเข้าสู่ระบบแอดมิน</h1><p>${message}</p><a class="btn" href="/">กลับหน้าหลัก</a></main></body></html>`,
    { status, headers: { "content-type": "text/html; charset=UTF-8", "cache-control": "no-store" } },
  );
}

export async function onRequest(context) {
  const configuredAdmin = normalizeEmail(context.env.ADMIN_EMAIL);
  if (!configuredAdmin) {
    return deny("ยังไม่ได้ตั้งค่า ADMIN_EMAIL ใน Cloudflare Pages", 503);
  }

  const accessEmail = normalizeEmail(
    context.request.headers.get("Cf-Access-Authenticated-User-Email"),
  );

  if (!accessEmail) {
    return deny(
      "ยังไม่ได้รับข้อมูลผู้ใช้จาก Cloudflare Access กรุณาตั้งค่า Access ให้ป้องกันเส้นทาง /admin/* แล้วล็อกอินด้วยอีเมลแอดมิน",
      401,
    );
  }

  if (accessEmail !== configuredAdmin) {
    return deny("อีเมลนี้ไม่มีสิทธิ์เข้าหน้าแอดมิน", 403);
  }

  context.data.adminEmail = accessEmail;
  return context.next();
}
