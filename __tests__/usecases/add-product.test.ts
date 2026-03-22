import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/adapters/google-sheets/product-repository", () => ({
  googleSheetsProductRepository: {
    listProducts: vi.fn(),
    findProductById: vi.fn(),
    updateProductStatuses: vi.fn(),
    addProduct: vi.fn(),
  },
}));

import { addProductUseCase } from "@/application/usecases/dashboard";
import { googleSheetsProductRepository } from "@/adapters/google-sheets/product-repository";

const mockFindProductById = vi.mocked(googleSheetsProductRepository.findProductById);
const mockAddProduct = vi.mocked(googleSheetsProductRepository.addProduct);

describe("addProductUseCase", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFindProductById.mockResolvedValue(null);
    mockAddProduct.mockResolvedValue(undefined);
  });

  it("空の商品IDでエラーになること", async () => {
    await expect(
      addProductUseCase({
        productId: "",
        title: "テスト商品",
        description: "",
        price: 1000,
        inventory: 5,
        platforms: ["creema"],
      })
    ).rejects.toThrow("商品IDは必須です。");
  });

  it("空白のみの商品IDでエラーになること", async () => {
    await expect(
      addProductUseCase({
        productId: "   ",
        title: "テスト商品",
        description: "",
        price: 1000,
        inventory: 5,
        platforms: ["creema"],
      })
    ).rejects.toThrow("商品IDは必須です。");
  });

  it("空の商品名でエラーになること", async () => {
    await expect(
      addProductUseCase({
        productId: "test-001",
        title: "",
        description: "",
        price: 1000,
        inventory: 5,
        platforms: ["creema"],
      })
    ).rejects.toThrow("商品名は必須です。");
  });

  it("出品先未選択でエラーになること", async () => {
    await expect(
      addProductUseCase({
        productId: "test-001",
        title: "テスト商品",
        description: "",
        price: 1000,
        inventory: 5,
        platforms: [],
      })
    ).rejects.toThrow("出品先を1つ以上選択してください。");
  });

  it("空文字のみのプラットフォームでエラーになること", async () => {
    await expect(
      addProductUseCase({
        productId: "test-001",
        title: "テスト商品",
        description: "",
        price: 1000,
        inventory: 5,
        platforms: ["", " "],
      })
    ).rejects.toThrow("出品先を1つ以上選択してください。");
  });

  it("重複する商品IDでエラーになること", async () => {
    mockFindProductById.mockResolvedValue({
      rowNumber: 2,
      id: "test-001",
      title: "既存商品",
      description: "",
      price: null,
      inventory: null,
      tags: [],
      platforms: [],
      syncStatus: "new",
      lastSyncedAt: null,
      lastError: null,
      platformSnapshots: [],
      raw: {},
    });

    await expect(
      addProductUseCase({
        productId: "test-001",
        title: "テスト商品",
        description: "",
        price: 1000,
        inventory: 5,
        platforms: ["creema"],
      })
    ).rejects.toThrow('商品ID "test-001" は既に存在します。');
  });

  it("正常系でaddProductが正しい引数で呼ばれること", async () => {
    await addProductUseCase({
      productId: " test-001 ",
      title: " テスト商品 ",
      description: " テスト説明 ",
      price: 3500,
      inventory: 10,
      platforms: ["Creema", " Minne "],
    });

    expect(mockAddProduct).toHaveBeenCalledOnce();
    expect(mockAddProduct).toHaveBeenCalledWith({
      productId: "test-001",
      title: "テスト商品",
      description: "テスト説明",
      price: 3500,
      inventory: 10,
      platforms: ["creema", "minne"],
    });
  });

  it("price/inventoryがnullでも正常に動作すること", async () => {
    await addProductUseCase({
      productId: "test-002",
      title: "テスト商品2",
      description: "",
      price: null,
      inventory: null,
      platforms: ["base"],
    });

    expect(mockAddProduct).toHaveBeenCalledWith({
      productId: "test-002",
      title: "テスト商品2",
      description: "",
      price: null,
      inventory: null,
      platforms: ["base"],
    });
  });

  it("findProductByIdにトリムされた商品IDが渡されること", async () => {
    await addProductUseCase({
      productId: " test-003 ",
      title: "テスト",
      description: "",
      price: null,
      inventory: null,
      platforms: ["iichi"],
    });

    expect(mockFindProductById).toHaveBeenCalledWith("test-003");
  });
});
