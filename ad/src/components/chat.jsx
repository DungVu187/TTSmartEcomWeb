import React, { useState, useEffect, useRef } from "react";
import {
  Box,
  Typography,
  Paper,
  List,
  ListItem,
  ListItemAvatar,
  ListItemText,
  Avatar,
  Divider,
  TextField,
  IconButton,
  CircularProgress,
} from "@mui/material";
import SendIcon from "@mui/icons-material/Send";
import ForumIcon from "@mui/icons-material/Forum";
import PersonIcon from "@mui/icons-material/Person";
import { io } from "socket.io-client";
import moment from "moment";
import toast from "react-hot-toast";

const apiUrl = import.meta.env.VITE_API_URL || "http://localhost:5000";

const Chat = () => {
  const [sessions, setSessions] = useState([]);
  const [selectedSession, setSelectedSession] = useState("");
  const [selectedName, setSelectedName] = useState("");
  const [messages, setMessages] = useState([]);
  const [messageText, setMessageText] = useState("");
  const [loadingSessions, setLoadingSessions] = useState(true);
  const [loadingHistory, setLoadingHistory] = useState(false);

  const socketRef = useRef(null);
  const messagesEndRef = useRef(null);

  // Cuộn khung chat xuống cuối
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // Kết nối socket.io chính của Admin
  useEffect(() => {
    const socket = io(apiUrl, {
      withCredentials: true,
      transports: ["websocket", "polling"],
    });
    socketRef.current = socket;

    // Tải danh sách phiên chat ban đầu
    const fetchSessions = async () => {
      try {
        const res = await fetch(`${apiUrl}/chat/sessions`, {
          credentials: "include",
        });
        const data = await res.json();
        if (data.success) {
          setSessions(data.sessions || []);
        }
      } catch (err) {
        console.error("Lỗi khi tải các cuộc trò chuyện:", err);
        toast.error("Không thể tải danh sách cuộc trò chuyện!");
      } finally {
        setLoadingSessions(false);
      }
    };
    fetchSessions();

    // Lắng nghe thông báo khi có tin nhắn mới trong bất kỳ phiên nào
    socket.on("admin_notify_msg", ({ sessionId, message }) => {
      setSessions((prev) => {
        const index = prev.findIndex((s) => s.sessionId === sessionId);
        const name = message.senderRole === "customer" ? message.senderName : "Admin";
        const phone = message.senderRole === "customer" ? message.senderPhone : "";

        // Trích xuất thông tin người dùng cũ hoặc mới
        const existingSession = index >= 0 ? prev[index] : null;
        const updatedSession = {
          sessionId,
          lastMessage: message.message,
          lastMessageTime: message.createdAt,
          senderName: existingSession && existingSession.senderName !== sessionId 
            ? existingSession.senderName 
            : (name !== "Admin" ? name : sessionId),
          senderPhone: existingSession && existingSession.senderPhone 
            ? existingSession.senderPhone 
            : phone,
        };

        if (index >= 0) {
          // Xóa bản ghi cũ và đưa bản ghi mới lên đầu danh sách
          const filtered = prev.filter((s) => s.sessionId !== sessionId);
          return [updatedSession, ...filtered];
        } else {
          // Thêm khách hàng mới lên đầu danh sách
          return [updatedSession, ...prev];
        }
      });
    });

    return () => {
      socket.disconnect();
    };
  }, []);

  // Khi chọn một phiên chat cụ thể
  useEffect(() => {
    if (!selectedSession || !socketRef.current) return;

    // Join vào phòng cụ thể của khách hàng đó để nhận tin nhắn trực tiếp
    socketRef.current.emit("join_chat", { sessionId: selectedSession });

    // Tải lịch sử chat
    const fetchHistory = async () => {
      setLoadingHistory(true);
      try {
        const res = await fetch(`${apiUrl}/chat/history/${selectedSession}`, {
          credentials: "include",
        });
        const data = await res.json();
        if (data.success) {
          setMessages(data.messages || []);
        }
      } catch (err) {
        console.error("Lỗi khi tải lịch sử:", err);
      } finally {
        setLoadingHistory(false);
      }
    };
    fetchHistory();

    // Đăng ký nhận tin nhắn mới trong phòng đã join
    socketRef.current.on("receive_msg", (newMsg) => {
      if (newMsg.sessionId === selectedSession) {
        setMessages((prev) => {
          // Tránh tin nhắn bị trùng lặp
          if (prev.some((m) => m._id === newMsg._id)) return prev;
          return [...prev, newMsg];
        });
      }
    });

    return () => {
      socketRef.current.off("receive_msg");
    };
  }, [selectedSession]);

  // Gửi tin nhắn trả lời khách hàng
  const handleSendMessage = (e) => {
    e.preventDefault();
    if (!messageText.trim() || !selectedSession || !socketRef.current) return;

    const msgPayload = {
      sessionId: selectedSession,
      senderPhone: "Admin",
      senderName: "Admin",
      senderRole: "admin",
      message: messageText.trim(),
    };

    socketRef.current.emit("send_msg", msgPayload);
    setMessageText("");
  };

  return (
    <Box sx={{ display: "flex", height: "calc(100vh - 40px)", m: -2.5, overflow: "hidden" }}>
      {/* CỘT TRÁI: DANH SÁCH CUỘC TRÒ CHUYỆN */}
      <Paper
        elevation={0}
        sx={{
          width: 320,
          borderRight: "1px solid",
          borderColor: "divider",
          display: "flex",
          flexDirection: "column",
          borderRadius: 0,
        }}
      >
        <Box sx={{ p: 2, borderBottom: "1px solid", borderColor: "divider" }}>
          <Typography variant="h6" fontWeight="bold">
            Chat hỗ trợ kỹ thuật
          </Typography>
        </Box>

        <Box sx={{ flex: 1, overflowY: "auto" }}>
          {loadingSessions ? (
            <Box sx={{ display: "flex", justifyContent: "center", mt: 4 }}>
              <CircularProgress size={30} />
            </Box>
          ) : sessions.length === 0 ? (
            <Box sx={{ p: 3, textAlign: "center" }}>
              <Typography color="text.secondary">Không có cuộc trò chuyện nào</Typography>
            </Box>
          ) : (
            <List disablePadding>
              {sessions.map((sess) => {
                const isSelected = sess.sessionId === selectedSession;
                return (
                  <React.Fragment key={sess.sessionId}>
                    <ListItem
                      onClick={() => {
                        setSelectedSession(sess.sessionId);
                        setSelectedName(sess.senderName);
                      }}
                      sx={{
                        cursor: "pointer",
                        backgroundColor: isSelected ? "action.selected" : "inherit",
                        "&:hover": {
                          backgroundColor: "action.hover",
                        },
                        py: 1.5,
                      }}
                    >
                      <ListItemAvatar>
                        <Avatar sx={{ bgcolor: isSelected ? "primary.main" : "grey.500" }}>
                          <PersonIcon />
                        </Avatar>
                      </ListItemAvatar>
                      <ListItemText
                        primary={
                          <Typography variant="subtitle2" fontWeight={isSelected ? "bold" : "regular"} noWrap>
                            {sess.senderName}
                          </Typography>
                        }
                        secondary={
                          <Typography variant="body2" color="text.secondary" noWrap>
                            {sess.lastMessage}
                          </Typography>
                        }
                      />
                      <Box sx={{ textAlign: "right", ml: 1, flexShrink: 0 }}>
                        <Typography variant="caption" color="text.secondary">
                          {moment(sess.lastMessageTime).format("HH:mm")}
                        </Typography>
                      </Box>
                    </ListItem>
                    <Divider />
                  </React.Fragment>
                );
              })}
            </List>
          )}
        </Box>
      </Paper>

      {/* CỘT PHẢI: KHUNG CHI TIẾT CUỘC TRÒ CHUYỆN */}
      <Box sx={{ flex: 1, display: "flex", flexDirection: "column", bgcolor: "grey.50" }}>
        {selectedSession ? (
          <>
            {/* Header thông tin khách hàng */}
            <Box
              sx={{
                p: 2,
                bgcolor: "background.paper",
                borderBottom: "1px solid",
                borderColor: "divider",
                display: "flex",
                alignItems: "center",
                gap: 2,
              }}
            >
              <Avatar sx={{ bgcolor: "primary.main" }}>
                <PersonIcon />
              </Avatar>
              <Box>
                <Typography variant="subtitle1" fontWeight="bold">
                  {selectedName}
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  Số điện thoại: {selectedSession}
                </Typography>
              </Box>
            </Box>

            {/* Vùng hội thoại hiển thị tin nhắn */}
            <Box sx={{ flex: 1, overflowY: "auto", p: 3, display: "flex", flexDirection: "column", gap: 2 }}>
              {loadingHistory ? (
                <Box sx={{ display: "flex", justifyContent: "center", my: "auto" }}>
                  <CircularProgress />
                </Box>
              ) : (
                messages.map((msg, index) => {
                  const isMe = msg.senderRole === "admin" || msg.senderRole === "staff";
                  return (
                    <Box
                      key={msg._id || index}
                      sx={{
                        display: "flex",
                        justifyContent: isMe ? "flex-end" : "flex-start",
                      }}
                    >
                      <Box
                        sx={{
                          maxWidth: "70%",
                          bgcolor: isMe ? "primary.main" : "background.paper",
                          color: isMe ? "primary.contrastText" : "text.primary",
                          p: 1.5,
                          borderRadius: 2,
                          boxShadow: 1,
                          borderBottomRightRadius: isMe ? 0 : 2,
                          borderBottomLeftRadius: isMe ? 2 : 0,
                        }}
                      >
                        <Typography variant="body2" sx={{ whiteSpace: "pre-wrap" }}>
                          {msg.message}
                        </Typography>
                        <Typography
                          variant="caption"
                          sx={{
                            display: "block",
                            textAlign: "right",
                            mt: 0.5,
                            opacity: 0.7,
                            fontSize: "0.7rem",
                          }}
                        >
                          {moment(msg.createdAt).format("HH:mm")}
                        </Typography>
                      </Box>
                    </Box>
                  );
                })
              )}
              <div ref={messagesEndRef} />
            </Box>

            {/* Input gửi tin nhắn ở cuối */}
            <Box
              component="form"
              onSubmit={handleSendMessage}
              sx={{
                p: 2,
                bgcolor: "background.paper",
                borderTop: "1px solid",
                borderColor: "divider",
                display: "flex",
                alignItems: "center",
                gap: 1,
              }}
            >
              <TextField
                fullWidth
                size="small"
                value={messageText}
                onChange={(e) => setMessageText(e.target.value)}
                placeholder="Nhập câu trả lời hỗ trợ..."
                autoComplete="off"
                variant="outlined"
                sx={{
                  "& .MuiOutlinedInput-root": {
                    borderRadius: 4,
                  },
                }}
              />
              <IconButton type="submit" color="primary" disabled={!messageText.trim()}>
                <SendIcon />
              </IconButton>
            </Box>
          </>
        ) : (
          <Box sx={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", flex: 1, color: "text.secondary", gap: 1 }}>
            <ForumIcon sx={{ fontSize: 60 }} />
            <Typography>Chọn một cuộc trò chuyện để bắt đầu trả lời hỗ trợ kỹ thuật</Typography>
          </Box>
        )}
      </Box>
    </Box>
  );
};

export default Chat;
