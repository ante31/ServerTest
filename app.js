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
const http = require('http');
const server = http.createServer(app);

const { Server } = require('socket.io');
const io = new Server(server, {
  cors: {
    origin: '*', // Dopušta apsolutno sve
    methods: ['GET', 'POST']
    // credentials: true -> OVO SMO IZBACILI
  },
  allowEIO3: true,
  transports: ['polling', 'websocket'] 
});

// Middleware
app.use(cors({
  origin: '*', // Dopušta apsolutno sve za fetch/axios
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'],
  allowedHeaders: ['Content-Type', 'Authorization']
  // credentials: true -> OVO SMO IZBACILI
}));

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

const PORT = process.env.PORT || 3000;

// OBAVEZNO "0.0.0.0" - bez toga Railway ne propušta vanjski promet
server.listen(PORT, "0.0.0.0", () => {
  console.log(`🚀 Server is back online on port ${PORT}`);
});
