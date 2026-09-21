import { tool } from "ai";
import { z } from "zod";
import {
  ApiRequestError,
  getCategories,
  getProductById,
  getProductStock,
  getProducts,
} from "@/lib/api";
import { start } from "workflow/api";
import { returnFlow } from "./workflows/return-flow";

export const searchProducts = tool({
  description: `Search the Vercel swag store product catalog. Use this for broad lookups: when the user asks what the store sells, wants recommendations, or is browsing a type of item. Returns a list of matching products with summary fields. For full details about one specific product, use getProductDetails instead.`,
  inputSchema: z.object({
    query: z
      .string()
      .optional()
      .describe(
        `Optional free-text search terms describing what the user is looking for, e.g. 'hoodie' or 'water bottle'.`,
      ),
    category: z
      .string()
      .optional()
      .describe(
        `Optional category slug to filter results. Only set this when the user clearly wants a specific category. Use the getAllCategories tool to get all valid categories.`,
      ),
  }),
  execute: async ({ query, category }) => {
    "use step";
    try {
      const products = await getProducts({
        search: query,
        category,
        limit: 10,
      });
      return {
        count: products.length,
        products: products.map((p) => ({
          id: p.id,
          name: p.name,
          slug: p.slug,
          image: p.images[0],
          price: p.price,
          currency: p.currency,
          category: p.category,
          description: p.description,
        })),
      };
    } catch (err) {
      const message =
        err instanceof ApiRequestError ? err.message : "Unknown error";
      return { count: 0, products: [], error: message };
    }
  },
});

export const getAllCategories = tool({
  description: `List every product category available in the Vercel swag store, along with the number of products in each. Use this when the user asks what categories exist, what kinds of products are sold, or wants to browse the store at a high level.`,
  inputSchema: z.object({}),
  execute: async () => {
    "use step";
    try {
      const categories = await getCategories();
      return {
        count: categories.length,
        categories: categories.map((c) => ({
          slug: c.slug,
          name: c.name,
          productCount: c.productCount,
        })),
      };
    } catch (err) {
      const message =
        err instanceof ApiRequestError ? err.message : "Unknown error";
      return { count: 0, categories: [], error: message };
    }
  },
});

export const getProductDetails = tool({
  description: `Fetch the full details for a single product by its id or slug, including all images, tags, and live stock levels. Use this when the user asks about one specific item (e.g. "Tell me more about the black hoodie" or "Is the enamel mug in stock?"). For broad lookups across many products, use searchProducts instead.`,
  inputSchema: z.object({
    idOrSlug: z
      .string()
      .describe(
        `The product id or slug to look up. Get this from a prior searchProducts result, or the slug the user references.`,
      ),
  }),
  execute: async ({ idOrSlug }) => {
    "use step";
    try {
      const product = await getProductById(idOrSlug);
      let stock: {
        stock: number;
        inStock: boolean;
        lowStock: boolean;
      } | null = null;
      try {
        const s = await getProductStock(product.id);
        stock = { stock: s.stock, inStock: s.inStock, lowStock: s.lowStock };
      } catch {
        // Stock is best-effort; the product details are still useful without it.
      }
      return {
        product: {
          id: product.id,
          name: product.name,
          slug: product.slug,
          description: product.description,
          price: product.price,
          currency: product.currency,
          category: product.category,
          images: product.images,
          tags: product.tags,
          featured: product.featured,
          stock,
        },
      };
    } catch (err) {
      const message =
        err instanceof ApiRequestError ? err.message : "Unknown error";
      return { error: message };
    }
  },
});

export const returnOrder = tool({
  description: `File a return for one of the user's past orders. The user must provide an order ID and a reason. Example order IDs: 11111, 22222, 33333.`,
  inputSchema: z.object({
    orderId: z.string().describe("The order ID the user wants to return."),
    reason: z
      .string()
      .min(10)
      .max(500)
      .describe("Why the user is returning the order."),
  }),
  execute: async ({ orderId, reason }) => {
    "use step";
    const run = await start(returnFlow, [orderId, reason]);
    return {
      runId: run.runId,
      message: `Return request received for order ${orderId}.`,
    };
  },
});
