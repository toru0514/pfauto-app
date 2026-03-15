import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  fetchWithRetry,
  FetchRetryExhaustedError,
} from "../../lib/fetch-with-retry";

describe("fetch-with-retry", () => {
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    // Mock console methods used by logger
    vi.spyOn(console, "log").mockImplementation(() => {});
    vi.spyOn(console, "error").mockImplementation(() => {});
    vi.spyOn(console, "warn").mockImplementation(() => {});
    vi.spyOn(console, "debug").mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it("should return successful response on first try", async () => {
    const mockResponse = new Response("OK", { status: 200 });
    fetchMock.mockResolvedValueOnce(mockResponse);

    const response = await fetchWithRetry("https://example.com");

    expect(response.status).toBe(200);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("should retry on 500 error and succeed on second attempt", async () => {
    const errorResponse = new Response("Server Error", { status: 500 });
    const successResponse = new Response("OK", { status: 200 });

    fetchMock
      .mockResolvedValueOnce(errorResponse)
      .mockResolvedValueOnce(successResponse);

    const response = await fetchWithRetry("https://example.com", undefined, {
      baseDelay: 10, // Speed up test
      maxRetries: 3,
    });

    expect(response.status).toBe(200);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("should throw error after max retries on HTTP 500", async () => {
    const errorResponse = new Response("Server Error", { status: 500 });
    fetchMock.mockResolvedValue(errorResponse);

    await expect(
      fetchWithRetry("https://example.com", undefined, {
        baseDelay: 10,
        maxRetries: 3,
      })
    ).rejects.toThrow("HTTP 500");

    expect(fetchMock).toHaveBeenCalledTimes(3);
  });

  it("should throw FetchRetryExhaustedError after max retries on network error", async () => {
    const networkError = new TypeError("Network error");
    fetchMock.mockRejectedValue(networkError);

    await expect(
      fetchWithRetry("https://example.com", undefined, {
        baseDelay: 10,
        maxRetries: 3,
      })
    ).rejects.toThrow(FetchRetryExhaustedError);

    expect(fetchMock).toHaveBeenCalledTimes(3);
  });

  it("should retry on network error", async () => {
    const networkError = new TypeError("Network error");
    const successResponse = new Response("OK", { status: 200 });

    fetchMock
      .mockRejectedValueOnce(networkError)
      .mockResolvedValueOnce(successResponse);

    const response = await fetchWithRetry("https://example.com", undefined, {
      baseDelay: 10,
    });

    expect(response.status).toBe(200);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("should retry on 429 rate limit", async () => {
    const rateLimitResponse = new Response("Too Many Requests", { status: 429 });
    const successResponse = new Response("OK", { status: 200 });

    fetchMock
      .mockResolvedValueOnce(rateLimitResponse)
      .mockResolvedValueOnce(successResponse);

    const response = await fetchWithRetry("https://example.com", undefined, {
      baseDelay: 10,
    });

    expect(response.status).toBe(200);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("should not retry on 400 client error", async () => {
    const clientErrorResponse = new Response("Bad Request", { status: 400 });
    fetchMock.mockResolvedValueOnce(clientErrorResponse);

    const response = await fetchWithRetry("https://example.com");

    expect(response.status).toBe(400);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("should not retry on 404 not found", async () => {
    const notFoundResponse = new Response("Not Found", { status: 404 });
    fetchMock.mockResolvedValueOnce(notFoundResponse);

    const response = await fetchWithRetry("https://example.com");

    expect(response.status).toBe(404);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("should handle abort signal for timeout", async () => {
    fetchMock.mockImplementation(
      () =>
        new Promise((_, reject) => {
          const error = new Error("Aborted");
          error.name = "AbortError";
          reject(error);
        })
    );

    await expect(
      fetchWithRetry("https://example.com", undefined, {
        timeout: 100,
        baseDelay: 10,
        maxRetries: 2,
      })
    ).rejects.toThrow();
  });

  it("should pass request init to fetch", async () => {
    const mockResponse = new Response("OK", { status: 200 });
    fetchMock.mockResolvedValueOnce(mockResponse);

    await fetchWithRetry("https://example.com", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ test: true }),
    });

    expect(fetchMock).toHaveBeenCalledWith(
      "https://example.com",
      expect.objectContaining({
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ test: true }),
      })
    );
  });
});
