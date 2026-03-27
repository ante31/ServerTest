// app.js
const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
require('dotenv').config();

// Firebase
const database = require('./dbConnect');

// Sockets
const generalSocket = require('./sockets/generalSocket');
const ordersSocket = require('./sockets/ordersSocket');
const frontendStatusSocket = require('./sockets/frontendStatusSocket');

// Routeri
const cjenikRouter = require('./routes/cjenikRouter');
const kategorijaRouter = require('./routes/kategorijaRouter');
const orderRouter = require('./routes/ordersRouter');
const generalRouter = require('./routes/generalRouter');
const extrasRouter = require('./routes/extrasRouter');
const authRouter = require('./routes/authRouter');
const annotationsRouter = require('./routes/annotationsRouter');
const loyaltyRouter = require('./routes/loyaltyRouter');
const qrRedirecter = require('./qrRedirecter');

// Express
const app = express();

// Socket
const http = require('http');
const server = http.createServer(app);

const { Server } = require('socket.io');
const io = new Server(server, {
  cors: {
    origin: (origin, callback) => callback(null, true), // Dopušta apsolutno sve
    methods: ["GET", "POST"],
    credentials: true
  },
  allowEIO3: true,
  transports: ['polling', 'websocket']
});

// Middleware
app.use(bodyParser.json());
app.use(express.json());
app.use(cors({
  origin: '*',
  methods: 'GET,POST,PUT,DELETE,PATCH',
  allowedHeaders: 'Content-Type,Authorization',
}));

// Test ruta
app.get('/', (req, res) => {
  res.send('Hello World!');
});

// API rute
app.use('/cjenik', cjenikRouter);
app.use('/orders', orderRouter);
app.use('/kategorije', kategorijaRouter);
app.use('/general', generalRouter);
app.use('/extras', extrasRouter);
app.use('/auth', authRouter);
app.use('/annotations', annotationsRouter);
app.use('/loyalty', loyaltyRouter);


generalSocket(io, database);
ordersSocket(io, database);
frontendStatusSocket(io, database);

// Pokretanje servera
const port = process.env.PORT || 3000;
const localhost = "localhost";
server.listen(port, () => {
  console.log(`🚀 Server is running on http://${localhost}:${port}`);
});
