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

  // 1. Kiểm tra xác thực người dùng khi load trang
  useEffect(() => {
    const checkUserAndProfile = async () => {
      try {
        // Ưu tiên lấy thông tin tài khoản đang đăng nhập từ backend trước
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
            // Đồng bộ phiên đăng nhập vào localStorage
            localStorage.setItem(
              "chat_session",
              JSON.stringify({ phone: userData.phone, name: userDispName })
            );
            return;
          }
        }
      } catch (err) {
        console.error("Lỗi check auth cho chat widget:", err);
      }

      // Nếu không đăng nhập, thử lấy từ localStorage (dành cho khách vãng lai đã chat trước đó)
      const savedSession = localStorage.getItem("chat_session");
      if (savedSession) {
        try {
          const session = JSON.parse(savedSession);
          if (session.phone && session.name) {
            setName(session.name);
            setPhone(session.phone);
          }
        } catch (e) {
          console.error("Lỗi đọc phiên chat từ localStorage", e);
        }
      }
    };

    checkUserAndProfile();
  }, []);

  // 2. Tự động kết nối Socket và tải lịch sử chat khi có số điện thoại (phone)
  useEffect(() => {
    if (!phone) return;

    let isMounted = true;

    // Tải lịch sử tin nhắn
    const fetchHistory = async () => {
      setLoadingHistory(true);
      try {
        const res = await fetch(`${apiUrl}/chat/history/${phone}`, {
          credentials: "include",
        });
        const data = await res.json();
        if (data.success && isMounted) {
          setMessages(data.messages || []);
        }
      } catch (err) {
        console.error("Không thể tải lịch sử chat:", err);
      } finally {
        if (isMounted) {
          setLoadingHistory(false);
        }
      }
    };
    fetchHistory();

    // Kết nối socket.io với cấu hình path động
    let socketUrl = apiUrl;
    let socketOptions = {
      withCredentials: true,
      transports: ["websocket", "polling"],
    };

    try {
      const parsedUrl = new URL(apiUrl);
      if (parsedUrl.pathname && parsedUrl.pathname !== "/") {
        socketUrl = parsedUrl.origin;
        socketOptions.path = parsedUrl.pathname.replace(/\/$/, "") + "/socket.io";
      }
    } catch (e) {
      console.warn("Lỗi phân tích cú pháp apiUrl cho socket:", e);
    }

    const socket = io(socketUrl, socketOptions);

    socketRef.current = socket;

    socket.on("connect", () => {
      socket.emit("join_chat", { sessionId: phone });
      if (isMounted) {
        setIsJoined(true);
      }
    });

    socket.on("receive_msg", (newMsg) => {
      if (isMounted) {
        setMessages((prev) => {
          // Tránh tin nhắn bị lặp bằng cách lọc ID trùng
          if (prev.some((m) => m._id === newMsg._id)) return prev;
          return [...prev, newMsg];
        });
      }
    });

    socket.on("disconnect", () => {
      if (isMounted) {
        setIsJoined(false);
      }
    });

    return () => {
      isMounted = false;
      socket.disconnect();
      socketRef.current = null;
    };
  }, [phone]);

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

    // Cập nhật name và phone, useEffect phụ thuộc vào phone sẽ tự động khởi chạy socket
    setName(trimmedName);
    setPhone(trimmedPhone);
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
