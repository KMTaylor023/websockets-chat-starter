const http = require('http');
const fs = require('fs');
const socketio = require('socket.io');


const port = process.env.PORT || process.env.NODE_PORT || 3000;

const index = fs.readFileSync(`${__dirname}/../client/client.html`);

const onRequest = (request, response) => {
  response.writeHead(200, { 'Content-Type': 'text/html' });
  response.write(index);
  response.end();
};

const app = http.createServer(onRequest).listen(port);

console.log(`Listening on 127.0.0.1:${port}`);

const io = socketio(app);

const users = {};


const serverMsg = (msg) => {
  io.sockets.in('room1').emit('msg', msg);
};

const socketMsg = (sock, msg, name) => {
  const socket = sock;
  const message = { msg };

  if (name) {
    message.name = name;
  }
  socket.emit('msg', message);
};


const serverCommands = {
  me: (sock, msg) => {
    const socket = sock;
    const message = {
      msg: `${socket.name} ${msg}`,
    };
    serverMsg(message);
  },
  help: (sock) => {
    const msg = '/me <msg> \n' +
            'prints to all: <your_nick> <msg> \n' +
            '/time \n' +
            'prints to you: <server_time>';
    socketMsg(sock, msg);
  },
  time: (sock) => {
    socketMsg(sock, Date());
  },
};

const onJoined = (sock) => {
  const socket = sock;

  socket.on('join', (data) => {
    const joinMsg = {
      msg: `There are ${Object.keys(users).length + 1} users online`,
    };

    socket.name = data.name;

    // using socket id instead for more names
    users[socket.id] = { name: socket.name };

    socketMsg(socket, joinMsg, 'server');

    socket.join('room1');

    const response = {
      name: 'server',
      msg: `${data.name} has joined the room.`,
    };
    socket.broadcast.to('room1').emit('msg', response);

    console.log(`${data.name} joined`);

    socketMsg(socket, 'You joined the room', 'server');
    socketMsg(socket, 'type "/help" for help', 'server');
  });
};

const handleCommand = (command, msg, sock) => {
  const socket = sock;

  if (serverCommands[command]) {
    serverCommands[command](socket, msg);
  } else {
    socketMsg(socket, 'Unknown command!', 'Error');
  }
};

const onMsg = (sock) => {
  const socket = sock;


  const command = /^\/(\w*)(.*)$/;

  socket.on('msgToServer', (data) => {
    const msg = data.msg.trim();
    const ret = command.exec(msg);

    if (ret) {
      handleCommand(ret[1], ret[2].trim(), socket);
      return;
    }
    serverMsg({ name: socket.name, msg });
  });
};

const onRename = (sock) => {
  const socket = sock;

  socket.on('rename', (data) => {
    users[socket.id].name = data.name;
    serverMsg({ name: 'server', msg: `${socket.name} has changed nick to ${data.name}` });
    socket.name = data.name;
  });
};

const onDisconnect = (sock) => {
  const socket = sock;

  socket.on('disconnect', (data) => {
    const message = `${socket.name} has left the room`;
    socket.broadcast.to('room1').emit('msg', { name: 'server', msg: message });
    socket.leave('room1');

    delete users[socket.id];

    console.log(`${data.name} left`);
    socket.close();
  });
};

io.sockets.on('connection', (socket) => {
  console.log('started');

  onRename(socket);
  onJoined(socket);
  onMsg(socket);
  onDisconnect(socket);
});

console.log('Websocket server started');

