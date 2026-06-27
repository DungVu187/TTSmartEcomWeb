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
const { router: activityLogRoutes } = require('./components/activitylog');
const { router: chatRoutes, ChatMessage } = require('./components/chat');
const { router: zaloRoutes } = require('./components/zalo');

// Tạo app + http server + socket.io
const app = express();
app.set('trust proxy', true);
const http = require('http');
const server = http.createServer(app);
const { Server } = require('socket.io');

const allowedOrigins = [
  process.env.FRONTEND_URL,
  process.env.ADDRESS, // Lấy động URL Cloudflare Tunnel từ file .env
  'https://ttsmart.com.vn',
  'https://irelia.online',
  'http://irelia.online',
  'http://localhost:3000',
  'http://localhost:5173',
  'http://127.0.0.1:3000',
  'http://127.0.0.1:5173'
].filter(Boolean);

const checkOrigin = (origin, callback) => {
  if (
    process.env.NODE_ENV === 'development' ||
    !origin ||
    allowedOrigins.includes(origin) ||
    origin.startsWith('http://192.168.') || // Tự động cho phép mọi IP trong mạng LAN nội bộ
    origin.endsWith('.loca.lt') ||
    origin.endsWith('.localtunnel.me') ||
    origin === 'null'
  ) {
    callback(null, true);
  } else {
    callback(null, false); // Trả về false thay vì ném lỗi gây crash 500
  }
};

// Khởi tạo Socket.IO
const io = new Server(server, {
  cors: {
    origin: checkOrigin,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    credentials: true,
  },
});

const activeSupports = new Map();

io.on('connection', (socket) => {
  console.log('✅ Socket connected:', socket.id);

  // Gửi danh sách các phòng đang được hỗ trợ cho client vừa kết nối
  const currentSupports = {};
  for (const [sessId, data] of activeSupports.entries()) {
    currentSupports[sessId] = { adminName: data.adminName, socketId: data.socketId };
  }
  socket.emit('active_supports_list', currentSupports);

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

  socket.on('occupy_session', ({ sessionId, adminName }) => {
    const currentSupport = activeSupports.get(sessionId);
    if (!currentSupport || currentSupport.socketId === socket.id) {
      activeSupports.set(sessionId, { adminName, socketId: socket.id });
      console.log(`🔒 Session ${sessionId} occupied by Admin ${adminName} (${socket.id})`);
      io.emit('session_occupied', { sessionId, adminName, socketId: socket.id });
    } else {
      console.log(`⚠️ Session ${sessionId} is already occupied by Admin ${currentSupport.adminName}. Occupy request from Admin ${adminName} (${socket.id}) is denied.`);
    }
  });

  socket.on('leave_session', ({ sessionId }) => {
    const support = activeSupports.get(sessionId);
    if (support && support.socketId === socket.id) {
      activeSupports.delete(sessionId);
      console.log(`🔓 Session ${sessionId} released`);
      io.emit('session_released', { sessionId });
    }
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
    for (const [sessionId, support] of activeSupports.entries()) {
      if (support.socketId === socket.id) {
        activeSupports.delete(sessionId);
        console.log(`🔓 Session ${sessionId} automatically released due to disconnect`);
        io.emit('session_released', { sessionId });
      }
    }
  });
});


// Lưu io vào app để các route khác (chỉ `order.js`) dùng được
app.set('io', io);

// Middleware
app.use(express.json());
app.use(cookieParser());

const corsOptions = {
  origin: checkOrigin,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'CSRF-Token'],
  credentials: true,
};

app.use(cors(corsOptions));
app.use(helmet({
  hsts: false,
  contentSecurityPolicy: false
}));

// Tiêu đề Cross-Origin-Resource-Policy
app.use((req, res, next) => {
  res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
  next();
});

// Kết nối MongoDB
if (process.env.NODE_ENV !== 'test') {
  const password = process.env.DB_PASSWORD;
  const uri = `mongodb://localhost:27017/`;
  mongoose.connect(uri)
    .then(async () => {
      console.log('Connected to MongoDB!');
      
      // Tự động quét và đồng bộ lại tổng tiền cho các đơn hàng cũ
      try {
        const { IpOrder } = require('./components/iporder');
        const { EpOrder } = require('./components/eporder');
        const { Product } = require('./components/product');

        console.log('🔄 Đang đồng bộ hóa tổng tiền các đơn hàng và trường adjusted trong Database...');

        // Đồng bộ trường adjusted cho sản phẩm cũ
        await Product.updateMany(
          { adjusted: { $exists: false } },
          { $set: { adjusted: true } }
        );

        const ipOrders = await IpOrder.find({});
        let ipUpdatedCount = 0;
        for (const order of ipOrders) {
          const calculatedTotal = (order.productList || []).reduce((sum, item) => {
            const priceNum = parseFloat(item.price?.replace(/\./g, "").replace(",", ".") || 0);
            return sum + priceNum * (item.quantity || 0);
          }, 0).toString();
          
          if (order.total !== calculatedTotal) {
            order.total = calculatedTotal;
            await order.save();
            ipUpdatedCount++;
          }
        }

        const epOrders = await EpOrder.find({});
        let epUpdatedCount = 0;
        for (const order of epOrders) {
          const calculatedTotal = (order.productList || []).reduce((sum, item) => {
            const priceNum = parseFloat(item.price?.replace(/\./g, "").replace(",", ".") || 0);
            return sum + priceNum * (item.quantity || 0);
          }, 0).toString();
          
          if (order.total !== calculatedTotal) {
            order.total = calculatedTotal;
            await order.save();
            epUpdatedCount++;
          }
        }

        console.log(`✅ Hoàn tất đồng bộ: Đã cập nhật ${ipUpdatedCount} đơn nhập, ${epUpdatedCount} đơn xuất.`);
      } catch (err) {
        console.error('⚠️ Lỗi khi đồng bộ tổng tiền đơn hàng:', err.message);
      }
    })
    .catch(err => console.error('MongoDB connection error:', err));
}

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
app.use('/activity-logs', activityLogRoutes);
app.use('/chat', chatRoutes);
app.use('/zalo', zaloRoutes);

// Static files
app.use('/images', express.static(path.join(__dirname, 'upload', 'images')));
app.use('/section-images', express.static(path.join(__dirname, 'upload', 'sections')));
app.use('/station', express.static(path.join(__dirname, 'upload', 'stations')));

// Serve admin dashboard static files
const adminDistPath = path.join(__dirname, '../ad/dist');
app.use('/admin', express.static(adminDistPath));

app.get('/admin/*', (req, res) => {
  res.set('Cache-Control', 'no-store, no-cache, must-revalidate, private');
  res.sendFile(path.join(adminDistPath, 'index.html'));
});

// Serve customer frontend static files
const feBuildPath = path.join(__dirname, '../fe/build');
app.use(express.static(feBuildPath));

// Fallback for React Router on customer website (exclude API endpoints)
app.get('*', (req, res, next) => {
  const apiPaths = [
    '/users', '/products', '/orders', '/chips', '/carts',
    '/manages', '/iporders', '/eporders', '/stations',
    '/histories', '/chat', '/images', '/section-images', '/zalo'
  ];
  const isApi = apiPaths.some(path => req.path.startsWith(path));
  const isStaticFile = /\.(jpg|jpeg|png|gif|webp|svg|css|js|ico|map)$/i.test(req.path);

  if (isApi || isStaticFile) {
    return next();
  }
  res.set('Cache-Control', 'no-store, no-cache, must-revalidate, private');
  res.sendFile(path.join(feBuildPath, 'index.html'));
});

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
if (process.env.NODE_ENV !== 'test') {
  const PORT = process.env.PORT || 5000;
  server.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
  });
}

module.exports = app;
