import React from "react";
import { render, screen, waitFor } from "@testing-library/react";
import { toast } from "react-hot-toast";
import AutoLog from "./autolog";

let mockCode = "secure-token";
const mockNavigate = jest.fn();

jest.mock("react-router-dom", () => ({
  useParams: () => ({ code: mockCode }),
  useNavigate: () => mockNavigate,
}), { virtual: true });

jest.mock("react-hot-toast", () => ({
  toast: {
    error: jest.fn(),
    success: jest.fn(),
  },
}));

const responseOf = ({ ok = true, data = {} } = {}) => ({
  ok,
  json: jest.fn().mockResolvedValue(data),
});

describe("customer automatic login", () => {
  const originalLocation = window.location;
  let assignedHref;

  beforeAll(() => {
    Object.defineProperty(window, "location", {
      configurable: true,
      value: {
        pathname: "/secure-token",
        search: "",
        get href() {
          return assignedHref;
        },
        set href(value) {
          assignedHref = value;
        },
      },
    });
  });

  afterAll(() => {
    Object.defineProperty(window, "location", {
      configurable: true,
      value: originalLocation,
    });
  });

  beforeEach(() => {
    process.env.REACT_APP_BACK_END = "http://backend.test";
    global.fetch = jest.fn();
    mockCode = "secure-token";
    assignedHref = "";
    window.location.search = "";
    toast.error.mockClear();
    toast.success.mockClear();
    mockNavigate.mockClear();
    jest.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  test("posts the one-time token using cookie credentials", async () => {
    fetch.mockResolvedValueOnce(responseOf());

    render(<AutoLog />);

    expect(screen.getByText("Đang đăng nhập tự động...")).toBeInTheDocument();
    await waitFor(() => expect(fetch).toHaveBeenCalledTimes(1));
    expect(fetch).toHaveBeenCalledWith(
      "http://backend.test/users/autologin",
      expect.objectContaining({
        method: "POST",
        credentials: "include",
        body: JSON.stringify({ token: "secure-token" }),
      })
    );
    await waitFor(() => expect(toast.success).toHaveBeenCalledWith("Đăng nhập tự động thành công!"));
  });

  test("allows a relative station redirect after successful automatic login", async () => {
    window.location.search = "?redirect=%2Fstation%2FHN-01%2Fsensors";
    fetch.mockResolvedValueOnce(responseOf());

    render(<AutoLog />);

    await waitFor(() => expect(assignedHref).toBe("/station/HN-01/sensors"));
  });

  test("rejects an external redirect and falls back to the station page", async () => {
    window.location.search = "?redirect=https%3A%2F%2Fevil.example%2Fsteal";
    fetch.mockResolvedValueOnce(responseOf());

    render(<AutoLog />);

    await waitFor(() => expect(assignedHref).toBe("/station"));
  });

  test("shows the backend error and does not redirect when the token is rejected", async () => {
    fetch.mockResolvedValueOnce(responseOf({
      ok: false,
      data: { message: "Mã đăng nhập đã hết hạn" },
    }));

    render(<AutoLog />);

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith("Mã đăng nhập đã hết hạn");
    });
    expect(toast.success).not.toHaveBeenCalled();
    expect(assignedHref).toBe("");
  });

  test("does not call the API when the route has no token", async () => {
    mockCode = "";

    render(<AutoLog />);

    await waitFor(() => expect(toast.error).toHaveBeenCalledWith("Không có mã đăng nhập."));
    expect(fetch).not.toHaveBeenCalled();
    expect(assignedHref).toBe("");
  });
});
