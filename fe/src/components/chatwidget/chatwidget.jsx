import React, { useState, useEffect, useRef } from "react";
import { io } from "socket.io-client";
import toast from "react-hot-toast";
import "./chatwidget.css";

const apiUrl = process.env.REACT_APP_BACK_END || "http://localhost:5000";

const ChatWidget = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [isJoined, setIsJoined] = useState(false);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [messageText, setMessageText] = useState("");
  const [messages, setMessages] = useState([]);
  const [loadingHistory, setLoadingHistory] = useState(false);
  
  const socketRef = useRef(null);
  const messagesEndRef = useRef(null);

  // Cuộn tin nhắn xuống cuối
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    if (isOpen) {
      scrollToBottom();
    }
  }, [messages, isOpen]);

  // Kiểm tra xác thực người dùng đã đăng nhập hoặc đã có phiên chat cũ
  useEffect(() => {
    const checkUserAndProfile = async () => {
      // 1. Kiểm tra xem có phiên chat cũ lưu ở localStorage không
      const savedSession = localStorage.getItem("chat_session");
      if (savedSession) {
        try {
          const session = JSON.parse(savedSession);
          if (session.phone && session.name) {
            setName(session.name);
            setPhone(session.phone);
            initializeChat(session.phone, session.name);
            return;
          }
        } catch (e) {
          console.error("Lỗi đọc phiên chat từ localStorage", e);
        }
      }

      // 2. Nếu không có, thử lấy profile từ backend nếu đã đăng nhập
      try {
        const response = await fetch(`${apiUrl}/users/profile`, {
          method: "GET",
          credentials: "include",
        });
        if (response.ok) {
          const userData = await response.json();
          if (userData && userData.phone) {
            const userDispName = userData.name || `Khách hàng ${userData.phone.slice(-4)}`;
            setName(userDispName);
            setPhone(userData.phone);
            initializeChat(userData.phone, userDispName);
          }
        }
      } catch (err) {
        console.error("Lỗi check auth cho chat widget:", err);
      }
    };

    checkUserAndProfile();

    return () => {
      if (socketRef.current) {
        socketRef.current.disconnect();
      }
    };
  }, []);

  // Khởi tạo kết nối Socket và tải lịch sử
  const initializeChat = async (userPhone, userName) => {
    if (socketRef.current) {
      socketRef.current.disconnect();
    }

    // Tải lịch sử tin nhắn
    setLoadingHistory(true);
    try {
      const res = await fetch(`${apiUrl}/chat/history/${userPhone}`, {
        credentials: "include",
      });
      const data = await res.json();
      if (data.success) {
        setMessages(data.messages || []);
      }
    } catch (err) {
      console.error("Không thể tải lịch sử chat:", err);
    } finally {
      setLoadingHistory(false);
    }

    // Kết nối socket.io
    const socket = io(apiUrl, {
      withCredentials: true,
      transports: ["websocket", "polling"],
    });

    socketRef.current = socket;

    socket.on("connect", () => {
      socket.emit("join_chat", { sessionId: userPhone });
      setIsJoined(true);
    });

    socket.on("receive_msg", (newMsg) => {
      setMessages((prev) => [...prev, newMsg]);
    });

    socket.on("disconnect", () => {
      setIsJoined(false);
    });
  };

  // Bắt đầu chat từ Form điền thông tin (dành cho khách chưa đăng nhập)
  const handleStartChatSubmit = (e) => {
    e.preventDefault();
    if (!name.trim()) {
      toast.error("Vui lòng nhập tên của bạn!");
      return;
    }
    if (!/^[0-9]{10,11}$/.test(phone.trim())) {
      toast.error("Số điện thoại không hợp lệ (10-11 số)!");
      return;
    }

    const trimmedPhone = phone.trim();
    const trimmedName = name.trim();

    localStorage.setItem(
      "chat_session",
      JSON.stringify({ phone: trimmedPhone, name: trimmedName })
    );

    initializeChat(trimmedPhone, trimmedName);
  };

  // Gửi tin nhắn
  const handleSendMessage = (e) => {
    e.preventDefault();
    if (!messageText.trim() || !socketRef.current || !isJoined) return;

    const msgPayload = {
      sessionId: phone,
      senderPhone: phone,
      senderName: name,
      senderRole: "customer",
      message: messageText.trim(),
    };

    socketRef.current.emit("send_msg", msgPayload);
    setMessageText("");
  };

  return (
    <div className={`chat-widget-container ${isOpen ? "open" : "closed"}`}>
      {/* Nút bấm tròn hiển thị nổi */}
      <button className="chat-trigger-btn" onClick={() => setIsOpen(!isOpen)}>
        {isOpen ? (
          <i className="fa-solid fa-xmark fa-xl"></i>
        ) : (
          <div className="chat-pulse-wrapper">
            <i className="fa-solid fa-comments fa-xl"></i>
            <span className="chat-tooltip">Hỗ trợ kỹ thuật</span>
          </div>
        )}
      </button>

      {/* Cửa sổ Chat */}
      {isOpen && (
        <div className="chat-window-glass">
          <header className="chat-header">
            <div className="chat-header-info">
              <span className="chat-status-dot online"></span>
              <div>
                <h4>Kỹ thuật viên TTSmart</h4>
                <p>Hỗ trợ trực tuyến trạm trộn</p>
              </div>
            </div>
          </header>

          <div className="chat-body">
            {!isJoined ? (
              // Form điền thông tin khi chưa liên kết session
              <form onSubmit={handleStartChatSubmit} className="chat-start-form">
                <p>Vui lòng để lại thông tin để nhân viên kỹ thuật hỗ trợ bạn tốt nhất!</p>
                <div className="form-group">
                  <label>Họ và Tên</label>
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Nhập tên của bạn"
                    required
                  />
                </div>
                <div className="form-group">
                  <label>Số điện thoại</label>
                  <input
                    type="tel"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value.replace(/\D/g, ""))}
                    placeholder="Nhập số điện thoại"
                    required
                  />
                </div>
                <button type="submit" className="btn-start-chat">
                  Bắt đầu trò chuyện
                </button>
              </form>
            ) : (
              // Khung chat tin nhắn
              <div className="chat-conversation-container">
                {loadingHistory ? (
                  <div className="chat-loading">Đang tải lịch sử...</div>
                ) : messages.length === 0 ? (
                  <div className="chat-welcome-msg">
                    Xin chào <strong>{name}</strong>! Chúng tôi có thể giúp gì cho bạn về kỹ thuật trạm trộn hôm nay?
                  </div>
                ) : (
                  messages.map((msg, index) => {
                    const isMe = msg.senderRole === "customer";
                    return (
                      <div
                        key={msg._id || index}
                        className={`chat-message-row ${isMe ? "outgoing" : "incoming"}`}
                      >
                        {!isMe && <div className="chat-avatar-support">KT</div>}
                        <div className="chat-message-bubble">
                          <p>{msg.message}</p>
                          <span className="chat-message-time">
                            {new Date(msg.createdAt || Date.now()).toLocaleTimeString([], {
                              hour: "2-digit",
                              minute: "2-digit",
                            })}
                          </span>
                        </div>
                      </div>
                    );
                  })
                )}
                <div ref={messagesEndRef} />
              </div>
            )}
          </div>

          {isJoined && (
            // Khung nhập tin nhắn
            <form onSubmit={handleSendMessage} className="chat-footer-form">
              <input
                type="text"
                value={messageText}
                onChange={(e) => setMessageText(e.target.value)}
                placeholder="Nhập câu hỏi của bạn..."
                required
              />
              <button type="submit" className="chat-send-btn">
                <i className="fa-solid fa-paper-plane"></i>
              </button>
            </form>
          )}
        </div>
      )}
    </div>
  );
};

export default ChatWidget;
