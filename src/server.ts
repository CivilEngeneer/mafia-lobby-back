import bodyParser from "body-parser";
import express from "express";
import session from "express-session";
import http from "http";
import path from "path";
import cors from "cors";
import { Server } from "socket.io";
import sharedsession from "express-socket.io-session";
import { Game, RoleSetting, User } from "./models/models";
import { assignRoles, resetRoles } from "./services/role.service";
import "dotenv/config";

const app = express();

app.use(express.static(path.join(__dirname, "dist")));
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: false }));
app.use(cors({
  origin: process.env.FRONT_ADDRESS,
  credentials: true,
}));
const sessionMiddleware = session({
  saveUninitialized: true,
  secret: "$eCuRiTy",
  cookie: {
    maxAge: 60 * 60 * 1000,
  },
});
app.use(sessionMiddleware);

const port = process.env.PORT || "3210";
const server = http.createServer(app);
server.listen(port, () => console.log(`API running on localhost:${port}`));

// Раздача статических файлов из папки dist
app.use(express.static(path.join(__dirname, '../../mafia-lobby-front/dist/mafia-lobby-front/')));

// Обработка всех маршрутов (кроме /v1) - отправка index.html
app.get('**', (req, res, next) => {
  res.sendFile(path.join(__dirname, '../../mafia-lobby-front/dist/mafia-lobby-front/index.html'));
});

export enum PermissionAnswer {
  userInGame,
  gameNotExists,
  userNotInGame,
}

app.post("/checkUserInGame", (req, res) => {
  // req.session.userId = req.session.id; // ??? нужно ли это здесь
  const id = req.session.id; // ??? нужно ли это здесь
  let result;
  if (!game) {
    result = PermissionAnswer.gameNotExists;
  } else if (game.users.some(x => x.id === req.session.id)) {
    result = PermissionAnswer.userInGame;
  } else {
    result = PermissionAnswer.userNotInGame;
  }
  res.send(JSON.stringify(result));
});

const io = new Server(server, {
  cookie: true,
  cors: {
    origin: process.env.FRONT_ADDRESS,
    methods: ['GET', 'POST'],
    credentials: true,
  }
});

io.engine.use(sessionMiddleware);
io.use(sharedsession(sessionMiddleware, { autoSave: true }));

let game: Game;

function initRoles(): RoleSetting[] {
  return [
    { role: "peaceful", amount: 1 },
    { role: "mafia", amount: 1 },
    { role: "commissar", amount: 1 },
    { role: "doctor", amount: 1 },
  ];
}

io.use((socket, next) => {
  const { id } = socket.request.session;
  socket.request.session.userId = id; //??? это нужно здесь
  const userName = socket.handshake.query['name'];

  if (!game) {
    game = {
      id: 'single room', users: [], roleSettings: initRoles(), state: 'new'
    };
    console.log('game created')
  }

  if (!game.users?.length) {
    if (userName && !Array.isArray(userName)) {
      game.users.push({ id: id, name: userName, type: "master", online: true });
    }
  }
  
  const user = game.users.find(x => x.id === id);
  if (user) {
    user.online = true;
    next();
  } else {
    if (userName && !Array.isArray(userName)) {
      if (!game.users.some(x => x.name === userName)) {
        game.users.push({ id: id, name: userName, type: "player", online: true });
        next();
      } else {
        next(new Error('name is already in use'));
      }
    } else {
      next(new Error('server error - name is required'));
    }
  }
})
;

io.on('connection', (socket) => {
  console.log(`user ${socket.request.session.id} connected`);
  socket.emit('set id', {id: socket.request.session.id})
  socket.join(game.id);
  updateGame();

  socket.on('userChanged', (user: User) => {
    const masters = game.users.filter(x=>x.type === "master");
    if (masters.length < 2 && masters.some(x=>x.id == user.id && x.type !== user.type)) {
      socket.emit('exception', { message: 'there is should be at least 1 master' });
      updateGame();
      return;
    }
    
    game.users.indexOf(user)
    game.users.some((x, i) => {
      if (x.id === user.id) {
        game.users[i] = user;
      }
    });
    updateGame();
  });

  socket.on('rolesChanged', (roleSettings: RoleSetting[]) => {
    game.roleSettings = roleSettings;
    updateGame();
  });

  socket.on('startGame', () => {
    if (game.state === "inProcess"){
      socket.emit('exception', { message: 'Game is in process couldn\'t to start new.' });
      return;
    }
    
    try {
      const players = game.users.filter(x => x.type === "player");
      const users = game.users.filter(x => x.type !== "player");
      game.users = [...assignRoles(players, game.roleSettings), ...users];
      game.state = "inProcess";
    } catch (er) {
      if (er instanceof Error) {
        socket.emit('exception', { message: er.message });
      }
    }

    updateGame();
  });
  
  socket.on('restartGame', () => {
    game.users = resetRoles(game.users);
    game.state = "new";
    
    updateGame();
  });

  socket.on('disconnect', () => {
    const user = game.users.find(x => x.id === socket.request.session.userId);
    
    if (user) {
      setTimeout(() => {
        if (!user.online && user.type === 'master' && game.users.filter(x=> x.type === 'master')?.length > 1) {
          game = {
            id: 'single room', users: [], roleSettings: initRoles(), state: 'new'
          }
          updateGame();
        }
      }, 1 * 60 * 1000);
      
      user.online = false;
      updateGame();
    }
  })
})

function updateGame() {
  io.to(game.id).emit('changed', JSON.stringify(game));
}
