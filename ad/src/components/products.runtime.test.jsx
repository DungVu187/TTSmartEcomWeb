import { render, screen, waitFor } from "@testing-library/react";
import { CssBaseline, ThemeProvider } from "@mui/material";
import { beforeEach, describe, expect, it, vi } from "vitest";
import theme from "../theme";
import Products from "./products";

vi.mock("react-router-dom", () => ({
  useNavigate: () => vi.fn(),
}));

vi.mock("../context/permissioncontext", () => ({
  usePermissions: () => ({ can: () => true }),
}));

vi.mock("react-hot-toast", () => ({
  default: { success: vi.fn(), error: vi.fn() },
}));

class ResizeObserverMock {
  observe() {}
  disconnect() {}
}

describe("Products runtime", () => {
  beforeEach(() => {
    globalThis.ResizeObserver = ResizeObserverMock;
    sessionStorage.clear();
    globalThis.fetch = vi.fn(async (url) => {
      if (String(url).includes("/products?")) {
        return { ok: true, json: async () => ({ products: [], total: 0 }) };
      }
      return { ok: true, json: async () => [] };
    });
  });

  it("renders the product page inside the enterprise theme", async () => {
    render(
      <ThemeProvider theme={theme}>
        <CssBaseline />
        <Products />
      </ThemeProvider>,
    );

    expect(screen.getByRole("heading", { name: "Danh mục sản phẩm" })).toBeInTheDocument();
    await waitFor(() => expect(globalThis.fetch).toHaveBeenCalled());
  });
});
