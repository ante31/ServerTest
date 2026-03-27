const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const http = require('http'); // Premješteno gore radi preglednosti
const { Server } = require('socket.io');
require('dotenv').config();

const database = require('./dbConnect');

// Sockets
const generalSocket = require('./sockets/generalSocket');
const ordersSocket = require('./sockets/ordersSocket');
const frontendStatusSocket = require('./sockets/frontendStatusSocket');

// Routeri (zadrži sve svoje require rute ovdje...)
// ...

const app = express();
const server = http.createServer(app);

// 1. CORS Middleware (Mora biti na vrhu!)
app.use(cors({
  origin: '*', 
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: true
}));

app.use(bodyParser.json());
app.use(express.json());

// 2. Socket.io konfiguracija
const io = new Server(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST'],
    credentials: true
  },
  allowEIO3: true,
  transports: ['polling', 'websocket'], // Omogući oboje
});

// Test ruta
app.get('/', (req, res) => {
  res.send('Server is alive!');
});

// API rute (tvoji app.use...)
// app.use('/orders', orderRouter); ...

generalSocket(io, database);
ordersSocket(io, database);
frontendStatusSocket(io, database);

// 3. Pokretanje na Railway portu
const PORT = process.env.PORT || 3000;

// OBAVEZNO dodaj "0.0.0.0"
server.listen(PORT, "0.0.0.0", () => {
  console.log(`🚀 Server is running on port ${PORT}`);
});
