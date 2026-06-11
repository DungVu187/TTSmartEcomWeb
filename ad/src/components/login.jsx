
import * as React from "react";
import { useState } from "react";
import { CssVarsProvider, extendTheme } from "@mui/joy/styles";
import CssBaseline from "@mui/joy/CssBaseline";
import Box from "@mui/joy/Box";
import Button from "@mui/joy/Button";
import FormControl from "@mui/joy/FormControl";
import FormLabel from "@mui/joy/FormLabel";
import Input from "@mui/joy/Input";
import Typography from "@mui/joy/Typography";
import Stack from "@mui/joy/Stack";
import Link from "@mui/joy/Link";
import Visibility from "@mui/icons-material/Visibility";
import VisibilityOff from "@mui/icons-material/VisibilityOff";
import toast from "react-hot-toast";
import logo from "../assets/logo.png";

const dashboardUrl = import.meta.env.VITE_DASHBOARD;
const adminLogin = import.meta.env.VITE_APP_ADMIN_LOGIN;

const customTheme = extendTheme({
  colorSchemes: {
    light: {
      palette: {
        background: {
          surface: "#fff",
        },
      },
    },
  },
});

export default function SignInPage() {
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const validatePhone = (phone) => {
    return /^[0-9]{10,11}$/.test(phone);
  };

  const handleLogin = async (e) => {
    e.preventDefault();
    setError("");
    if (isLoading) return;

    if (!validatePhone(phone)) {
      setError("Số điện thoại phải là chuỗi số từ 10 đến 11 chữ số.");
      toast.error("Vui lòng nhập số điện thoại hợp lệ!");
      return;
    }

    if (!password) {
      setError("Mật khẩu không được để trống.");
      toast.error("Vui lòng nhập mật khẩu!");
      return;
    }

    setIsLoading(true);
    try {
      const response = await fetch(`${adminLogin}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone, password }),
        credentials: "include",
      });

      const data = await response.json();

      if (response.ok) {
        toast.success("Đăng nhập thành công!");
        setTimeout(() => {
          window.location.href = `${dashboardUrl}`;
        }, 1000);
      } else {
        if (response.status === 401) {
          setError("Thông tin đăng nhập không đúng.");
          toast.error("Số điện thoại hoặc mật khẩu không đúng!");
        } else if (response.status === 403) {
          setError("Bạn không có quyền truy cập vào trang admin.");
          toast.error("Bạn không có quyền admin!");
        } else {
          setError(data.message || "Đăng nhập thất bại!");
          toast.error(data.message || "Đăng nhập thất bại!");
        }
      }
    } catch (error) {
      setError("Không thể kết nối đến server. Vui lòng thử lại sau.");
      toast.error("Đã xảy ra lỗi. Vui lòng thử lại sau!");
    } finally {
      setIsLoading(false);
    }
  };

  const togglePasswordVisibility = () => {
    setShowPassword((prev) => !prev);
  };

  return (
    <CssVarsProvider theme={customTheme}>
      <CssBaseline />
      <Box
        sx={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          minHeight: "100vh",
          width: "100%",
          px: 2,
          transition: "background-color 0.3s ease",
        }}
      >
        <Box
          sx={{
            width: 400,
            maxWidth: "100%",
            p: 3,
            borderRadius: "sm",
            boxShadow: "lg",
            backgroundColor: "background.surface",
            transition: "all 0.3s ease",
          }}
        >
          <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 2 }}>
            <img
              src={logo}
              alt="Logo công ty"
              style={{
                height: "75px",
                width: "auto",
                display: "block",
                marginLeft: "-25px",
              }}
            />
          </Box>
          <Typography component="h1" level="h3" gutterBottom>
            Đăng nhập Admin
          </Typography>
          {error && <Typography color="danger">{error}</Typography>}

          <form onSubmit={handleLogin} autoComplete="on">
            {/* Input ẩn để Chrome nhận diện username/password */}
            <input
              type="text"
              name="username"
              autoComplete="username"
              style={{ display: "none" }}
            />
            <input
              type="password"
              name="password"
              autoComplete="current-password"
              style={{ display: "none" }}
            />

            <Stack spacing={2}>
              <FormControl required>
                <FormLabel>Số điện thoại</FormLabel>
                <Input
                  type="text"
                  name="username"
                  autoComplete="username"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value.replace(/\D/g, ""))}
                  placeholder="Nhập số điện thoại"
                />
              </FormControl>
              <FormControl required>
                <FormLabel>Mật khẩu</FormLabel>
                <Input
                  type={showPassword ? "text" : "password"}
                  name="password"
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Nhập mật khẩu"
                  endDecorator={
                    <Button
                      variant="plain"
                      onClick={togglePasswordVisibility}
                      sx={{ minWidth: "auto", p: 1 }}
                    >
                      {showPassword ? <VisibilityOff /> : <Visibility />}
                    </Button>
                  }
                />
              </FormControl>
              <Box
                sx={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                }}
              >
                <Link
                  onClick={() => toast.info("Chức năng quên mật khẩu đang được phát triển!")}
                >
                  Quên mật khẩu?
                </Link>
              </Box>
              <Button
                type="submit"
                fullWidth
                disabled={isLoading}
                loading={isLoading}
                sx={{ transition: "all 0.3s ease" }}
              >
                {isLoading ? "Đang xử lý..." : "Đăng nhập"}
              </Button>
            </Stack>
          </form>
        </Box>
        <Typography level="body-xs" sx={{ textAlign: "center", mt: 2 }}>
          © TTSmart {new Date().getFullYear()}
        </Typography>
      </Box>
    </CssVarsProvider>
  );
}