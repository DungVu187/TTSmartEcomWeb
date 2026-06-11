require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const helmet = require('helmet');
const cookieParser = require('cookie-parser');
const path = require('path');

// Router imports
const { router: userRoutes } = require('./components/user');
const { router: productRoutes } = require('./components/product');
const { router: orderRoutes } = require('./components/order');
const { router: chipRoutes } = require('./components/chip');
const { router: cartRoutes } = require('./components/cart');
const { router: manageRoutes } = require('./components/manage');
const { router: iporderRoutes } = require('./components/iporder');
const { router: eporderRoutes } = require('./components/eporder');
const { router: stationRoutes } = require('./components/station');
const { router: historyRoutes } = require('./components/storagehistory');
const { router: chatRoutes, ChatMessage } = require('./components/chat');

// Tạo app + http server + socket.io
const app = express();
const http = require('http');
const server = http.createServer(app);
const { Server } = require('socket.io');

// Khởi tạo Socket.IO
const io = new Server(server, {
  cors: {
    origin: [
      process.env.FRONTEND_URL,
      'https://ttsmart.com.vn',
      'http://localhost:3000',
      'http://localhost:5173'
    ].filter(Boolean),
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    credentials: true,
  },
});

io.on('connection', (socket) => {
  console.log('✅ Socket connected:', socket.id);

  // Log sự kiện tùy chỉnh nhận từ client
  socket.onAny((event, ...args) => {
    console.log(`📨 Received event "${event}" with data:`, args);
  });

  // Gửi test sự kiện về client (tùy chọn)
  socket.emit('server:hello', { message: 'Hello from server!' });

  // Lắng nghe sự kiện Chat hỗ trợ kỹ thuật
  socket.on('join_chat', ({ sessionId }) => {
    socket.join(`room_${sessionId}`);
    console.log(`💬 Socket ${socket.id} joined room_${sessionId}`);
  });

  socket.on('send_msg', async (data) => {
    const { sessionId, senderPhone, senderName, senderRole, message } = data;
    try {
      const newMsg = new ChatMessage({
        sessionId,
        senderPhone,
        senderName,
        senderRole,
        message,
      });
      await newMsg.save();

      // Gửi tin nhắn đến mọi client trong phòng room_<sessionId> (bao gồm khách hàng và admin đang xem phòng đó)
      io.to(`room_${sessionId}`).emit('receive_msg', newMsg);

      // Thông báo cho tất cả admin/staff về tin nhắn mới (để cập nhật danh sách phiên chat ở admin panel)
      io.emit('admin_notify_msg', { sessionId, message: newMsg });
    } catch (err) {
      console.error("Lỗi khi lưu tin nhắn chat socket:", err.message);
    }
  });

  // Khi client ngắt kết nối
  socket.on('disconnect', (reason) => {
    console.log(`❌ Socket disconnected (${socket.id}): ${reason}`);
  });
});


// Lưu io vào app để các route khác (chỉ `order.js`) dùng được
app.set('io', io);

// Middleware
app.use(express.json());
app.use(cookieParser());

// CORS cấu hình
const allowedOrigins = [
  process.env.FRONTEND_URL,
  'https://ttsmart.com.vn',
  'http://localhost:3000',
  'http://localhost:5173'
].filter(Boolean);

const corsOptions = {
  origin: (origin, callback) => {
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'CSRF-Token'],
  credentials: true,
};

app.use(cors(corsOptions));
app.use(helmet());

// Tiêu đề Cross-Origin-Resource-Policy
app.use((req, res, next) => {
  res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
  next();
});

// Kết nối MongoDB
const password = process.env.DB_PASSWORD;
const uri = `mongodb://localhost:27017/`;
mongoose.connect(uri)
  .then(() => console.log('Connected to MongoDB!'))
  .catch(err => console.error('MongoDB connection error:', err));

// Routes
app.use('/users', userRoutes);
app.use('/products', productRoutes);
app.use('/orders', orderRoutes); // <== chỉ route này có thể dùng io.emit()
app.use('/chips', chipRoutes);
app.use('/carts', cartRoutes);
app.use('/manages', manageRoutes);
app.use('/iporders', iporderRoutes);
app.use('/eporders', eporderRoutes);
app.use('/stations', stationRoutes);
app.use('/histories', historyRoutes);
app.use('/chat', chatRoutes);

// Static files
app.use('/images', express.static(path.join(__dirname, 'upload', 'images')));
app.use('/section-images', express.static(path.join(__dirname, 'upload', 'sections')));
app.use('/station', express.static(path.join(__dirname, 'upload', 'stations')));

// 404 handler
app.use((req, res, next) => {
  res.status(404).json({ message: 'Route not found' });
});

// Error handler
app.use((err, req, res, next) => {
  console.error('Server error:', err.message);
  res.status(500).json({ message: 'Internal server error' });
});

// Start server with socket
const PORT = process.env.PORT || 5000;
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
