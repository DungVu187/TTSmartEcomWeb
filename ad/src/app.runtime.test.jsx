import { render, screen, waitFor } from "@testing-library/react";
import { CssBaseline, ThemeProvider } from "@mui/material";
import { beforeEach, describe, expect, it, vi } from "vitest";
import App from "./App";
import theme from "./theme";
import { OrderProvider } from "./context/ordercontext";

vi.mock("socket.io-client", () => ({
  io: () => ({ on: vi.fn(), off: vi.fn(), disconnect: vi.fn() }),
}));

class ResizeObserverMock {
  observe() {}
  disconnect() {}
}

describe("Admin product route runtime", () => {
  beforeEach(() => {
    globalThis.ResizeObserver = ResizeObserverMock;
    sessionStorage.clear();
    window.history.pushState({}, "", "/admin/product");
    globalThis.fetch = vi.fn(async (url) => {
      const target = String(url);
      if (target.includes("/users/profile")) {
        return {
          ok: true,
          json: async () => ({ name: "Admin", role: "admin", permissions: [] }),
        };
      }
      if (target.includes("/products?")) {
        return { ok: true, json: async () => ({ products: [], total: 0 }) };
      }
      if (target.includes("/orders/processing-count")) {
        return { ok: true, json: async () => ({ success: true, count: 0 }) };
      }
      return { ok: true, json: async () => [] };
    });
  });

  it("renders the complete product route", async () => {
    render(
      <ThemeProvider theme={theme}>
        <CssBaseline />
        <OrderProvider>
          <App />
        </OrderProvider>
      </ThemeProvider>,
    );

    await waitFor(() => {
      expect(screen.getByRole("heading", { name: "Danh mục sản phẩm" })).toBeInTheDocument();
    });
  });
});
