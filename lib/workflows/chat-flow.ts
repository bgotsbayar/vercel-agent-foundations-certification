import { DurableAgent } from "@workflow/ai/agent";
import { getWritable } from "workflow";
import {
  convertToModelMessages,
  type UIMessage,
  type UIMessageChunk,
} from "ai";
import {
  searchProducts,
  getAllCategories,
  getProductDetails,
  returnOrder,
} from "@/lib/tools";

export async function chatFlow(messages: UIMessage[]) {
  "use workflow";
  const modelMessages = await convertToModelMessages(messages);
  const agent = new DurableAgent({
    model: "anthropic/claude-sonnet-4.6",
    instructions: `You are a friendly, knowledgeable shopping assistant for the Vercel swag store, "Ship It Shop".

Use your tools to look up real catalog data before answering — never invent products, prices, or stock.


Tool usage:
- searchProducts: broad lookups when the user asks what the store sells, wants recommendations, or is browsing a type of item.
- getAllCategories: when the user asks about a type or category of product, call this first to get valid category slugs before calling searchProducts with a category.
- getProductDetails: when the user asks about one specific item (e.g. "Tell me more about the black hoodie" or "Is it in stock?"), call this for full details and live stock instead of relying on searchProducts fields.
- returnOrder: when the user wants to return an order. Ask for the order ID and reason if they haven't provided them. Example order IDs are 11111, 22222, and 33333.

Tone: warm, concise, and genuinely helpful. Stay focused on the Vercel swag store; if asked something off-topic, gently steer back to how you can help them shop.`,
    tools: { searchProducts, getAllCategories, getProductDetails, returnOrder },
  });

  await agent.stream({
    messages: modelMessages,
    writable: getWritable<UIMessageChunk>(),
  });
}
