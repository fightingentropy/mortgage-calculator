const port = Number(process.env.PORT) || 3000;

const server = Bun.serve({
  port,
  fetch(req) {
    const url = new URL(req.url);
    let pathname = url.pathname;
    if (pathname === "/") pathname = "/index.html";

    // Prevent directory traversal
    const safePath = pathname.replace(/\.\.+/g, "").replace(/^\//, "");

    try {
      const file = Bun.file(safePath);
      return new Response(file);
    } catch {
      return new Response("Not found", { status: 404 });
    }
  }
});

console.log(`Server running at http://localhost:${server.port}`);


