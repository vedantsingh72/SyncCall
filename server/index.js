const { Server } = require("socket.io");

const io = new Server(8000, {
  cors: true,
});

const emailToSocketIdMap = new Map();
const socketidToEmailMap = new Map();

io.on("connection", (socket) => {
  console.log(`Socket Connected`, socket.id);

  socket.on("disconnecting", () => {
    for (const room of socket.rooms) {
      if (room === socket.id) continue;
      socket.to(room).emit("user:left", { id: socket.id });
    }
  });

  socket.on("disconnect", () => {
    const email = socketidToEmailMap.get(socket.id);
    if (email) emailToSocketIdMap.delete(email);
    socketidToEmailMap.delete(socket.id);
  });

  socket.on("room:join", async (data) => {
    const { email, room } = data;
    emailToSocketIdMap.set(email, socket.id);
    socketidToEmailMap.set(socket.id, email);
    await socket.join(room);
    socket.emit("room:join", data);

    const others = await io.in(room).fetchSockets();
    for (const s of others) {
      if (s.id === socket.id) continue;
      const otherEmail = socketidToEmailMap.get(s.id);
      if (otherEmail) {
        socket.emit("user:joined", { email: otherEmail, id: s.id });
      }
    }

    socket.to(room).emit("user:joined", { email, id: socket.id });
  });

  socket.on("user:call", ({ to, offer }) => {
    const fromEmail = socketidToEmailMap.get(socket.id);
    io.to(to).emit("incomming:call", {
      from: socket.id,
      offer,
      email: fromEmail,
    });
  });

  socket.on("call:accepted", ({ to, ans }) => {
    io.to(to).emit("call:accepted", { from: socket.id, ans });
  });

  socket.on("peer:nego:needed", ({ to, offer }) => {
    console.log("peer:nego:needed", offer);
    io.to(to).emit("peer:nego:needed", { from: socket.id, offer });
  });

  socket.on("peer:nego:done", ({ to, ans }) => {
    console.log("peer:nego:done", ans);
    io.to(to).emit("peer:nego:final", { from: socket.id, ans });
  });
});
