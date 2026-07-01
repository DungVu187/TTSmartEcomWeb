import React, { useState, useRef, useEffect } from "react";
import { Fab, Tooltip, CircularProgress, Box } from "@mui/material";
import MicIcon from "@mui/icons-material/Mic";
import GraphicEqIcon from "@mui/icons-material/GraphicEq";
import { useNavigate } from "react-router-dom";
import toast from "react-hot-toast";

const apiUrl = process.env.REACT_APP_BACK_END;

const VoiceSearchFAB = () => {
  const [isRecording, setIsRecording] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);
  const recordingTimeoutRef = useRef(null);
  const lastTriggerRef = useRef(0);
  const isStartingRef = useRef(false);
  const navigate = useNavigate();

  useEffect(() => {
    const checkLoginStatus = async () => {
      try {
        const response = await fetch(`${apiUrl}/users/profile`, {
          method: "GET",
          credentials: "include",
        });
        if (response.ok) {
          setIsLoggedIn(true);
        } else {
          setIsLoggedIn(false);
        }
      } catch (err) {
        console.error("Lỗi kiểm tra trạng thái đăng nhập:", err);
        setIsLoggedIn(false);
      }
    };

    checkLoginStatus();
  }, []);

  const toggleRecording = () => {
    const now = Date.now();
    if (now - lastTriggerRef.current < 300) {
      return;
    }
    lastTriggerRef.current = now;

    if (isProcessing || isStartingRef.current) return;

    if (isRecording) {
      stopRecording();
    } else {
      startRecording();
    }
  };

  const startRecording = async () => {
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      toast.error("Trình duyệt yêu cầu kết nối bảo mật HTTPS hoặc Localhost để sử dụng Micro!", {
        duration: 5000
      });
      return;
    }

    try {
      isStartingRef.current = true;
      setIsRecording(true);
      audioChunksRef.current = [];

      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });

      let options = { mimeType: "audio/webm" };
      if (!MediaRecorder.isTypeSupported(options.mimeType)) {
        options = { mimeType: "audio/ogg" };
      }
      if (!MediaRecorder.isTypeSupported(options.mimeType)) {
        options = { mimeType: "" };
      }

      const mediaRecorder = new MediaRecorder(stream, options);
      mediaRecorderRef.current = mediaRecorder;

      mediaRecorder.ondataavailable = (event) => {
        if (event.data && event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = async () => {
        stream.getTracks().forEach((track) => track.stop());

        const audioBlob = new Blob(audioChunksRef.current, {
          type: mediaRecorder.mimeType || "audio/webm",
        });

        if (audioBlob.size < 1000) {
          toast.error("Vui lòng nói lâu hơn một chút trước khi bấm dừng!");
          setIsProcessing(false);
          return;
        }

        await sendAudioToAPI(audioBlob);
      };

      mediaRecorder.start();
      toast.success("Đang lắng nghe... Bấm lại nút micro khi nói xong.", {
        id: "voice-status-fe",
        duration: 3000,
      });

      recordingTimeoutRef.current = setTimeout(() => {
        stopRecording();
      }, 15000);

    } catch (err) {
      console.error("Lỗi truy cập micro:", err);
      toast.error("Không thể mở micro. Vui lòng cấp quyền micro cho trang web.");
      setIsRecording(false);
    } finally {
      isStartingRef.current = false;
    }
  };

  const stopRecording = () => {
    if (recordingTimeoutRef.current) {
      clearTimeout(recordingTimeoutRef.current);
    }

    if (mediaRecorderRef.current && mediaRecorderRef.current.state === "recording") {
      setIsProcessing(true);
      mediaRecorderRef.current.stop();
    }
    setIsRecording(false);
  };

  const sendAudioToAPI = async (audioBlob) => {
    toast.loading("Đang xử lý giọng nói...", { id: "voice-status-fe" });
    try {
      const formData = new FormData();
      formData.append("audio", audioBlob, "query.webm");

      const response = await fetch(`${apiUrl}/products/voice-query`, {
        method: "POST",
        body: formData,
        credentials: "include",
      });

      const data = await response.json();

      if (response.ok && data.success) {
        const keyword = data.keyword || "";
        const filters = data.filters || {};
        
        toast.success(`Tìm kiếm: "${keyword || data.transcript}"`, {
          id: "voice-status-fe",
          duration: 3000,
        });

        // Construct search query string
        const params = new URLSearchParams();
        let searchVal = filters.code ? filters.code : (keyword || "");

        if (searchVal) params.set("search", searchVal);
        if (filters.brand) params.set("brand", filters.brand);
        if (filters.type) params.set("type", filters.type);

        navigate(`/product?${params.toString()}`);
      } else {
        throw new Error(data.message || "Không phân tích được âm thanh.");
      }
    } catch (err) {
      console.error("Lỗi voice-query API:", err);
      toast.error(err.message || "Gặp lỗi khi xử lý giọng nói.", {
        id: "voice-status-fe",
      });
    } finally {
      setIsProcessing(false);
    }
  };

  if (!isLoggedIn) return null;

  return (
    <Box
      sx={{
        position: "fixed",
        bottom: 24,
        right: 24,
        zIndex: 9999,
      }}
    >
      <Tooltip
        title={
          isRecording
            ? "Bấm lại để dừng và tìm kiếm"
            : isProcessing
            ? "Đang xử lý..."
            : "Bấm để bắt đầu tìm kiếm bằng giọng nói"
        }
        placement="top"
        arrow
      >
        <Fab
          color={isRecording ? "error" : "primary"}
          onClick={toggleRecording}
          onContextMenu={(e) => e.preventDefault()}
          sx={{
            width: 56,
            height: 56,
            boxShadow: isRecording
              ? "0 0 20px #d32f2f, 0 0 40px #d32f2f"
              : "0 4px 10px rgba(0,0,0,0.3)",
            transition: "all 0.3s ease",
            transform: isRecording ? "scale(1.15)" : "scale(1)",
            "&::after": isRecording
              ? {
                  content: '""',
                  position: "absolute",
                  width: "100%",
                  height: "100%",
                  borderRadius: "50%",
                  border: "2px solid #d32f2f",
                  animation: "pulse 1.2s infinite ease-in-out",
                }
              : {},
            "@keyframes pulse": {
              "0%": { transform: "scale(1)", opacity: 1 },
              "100%": { transform: "scale(1.8)", opacity: 0 },
            },
          }}
        >
          {isProcessing ? (
            <CircularProgress size={24} color="inherit" />
          ) : isRecording ? (
            <GraphicEqIcon />
          ) : (
            <MicIcon />
          )}
        </Fab>
      </Tooltip>
    </Box>
  );
};

export default VoiceSearchFAB;
