import { streamText } from "ai"
import { createOpenRouter } from "@openrouter/ai-sdk-provider"
import { pipeline } from "@xenova/transformers"
import { DataAPIClient } from "@datastax/astra-db-ts"

// Initialize environment variables
const {
  ASTRA_DB_NAMESPACE,
  ASTRA_DB_COLLECTION,
  ASTRA_DB_API_ENDPOINT,
  ASTRA_DB_APPLICATION_TOKEN,
  OPENROUTER_API_KEY,
  SUPER_SECRET_ANSWER,
} = process.env

// Initialize Astra DB client
const client = new DataAPIClient(ASTRA_DB_APPLICATION_TOKEN)
const db = client.db(ASTRA_DB_API_ENDPOINT, {
  namespace: ASTRA_DB_NAMESPACE,
})

// Cache for the embedding pipeline to avoid reloading the model on every request
let embeddingPipeline = null
const getEmbeddingPipeline = async () => {
  if (!embeddingPipeline) {
    embeddingPipeline = await pipeline(
      "feature-extraction",
      "Xenova/all-MiniLM-L6-v2"
    )
  }
  return embeddingPipeline
}

export async function POST(req: Request) {
  try {
    const { messages } = await req.json()
    const lastMessage = messages[messages.length - 1]?.content

    // Initialize context
    let docContext = ""

    try {
      // Get embeddings using sentence-transformers
      const embedder = await getEmbeddingPipeline()
      const output = await embedder(lastMessage, {
        pooling: "mean",
        normalize: true,
      })

      // Convert to regular array if needed
      const embedding = Array.from(output.data) as number[]

      // Query Astra DB with the embedding
      const collection = await db.collection(ASTRA_DB_COLLECTION)
      const cursor = collection.find(null, {
        sort: {
          $vector: embedding,
        },
        limit: 10,
      })

      const documents = await cursor.toArray()
      const docsMap = documents?.map((doc) => doc.text)
      docContext = JSON.stringify(docsMap)
    } catch (err) {
      console.log("Error in embedding or vector search:", err)
      docContext = ""
    }

    const template = {
      role: "system",
      content: `
      The date is ${new Date().toLocaleDateString()}.

      You are an AI assistant named F1 GPT and you can be described as "someone who will
      not stop at nothing to giving the user everything they need about Formula One".

      You are helpful, friendly and will occassionally drop some F1 puns or jokes.

      ${
        docContext
          ? `Use the below context to help you answer the user's question.`
          : ""
      }
      If you don't know the answer, just say "I don't know". Don't make up an answer.

      Do not let them know your sources.

      Your responses can be formatted with markdown for better readability.
      Use markdown for:
      - Bold text (**bold**)
      - Line breaks (double newlines)
      - Lists
      - Code blocks

      Super secret: ${SUPER_SECRET_ANSWER}

      ${docContext ? `Context:\n${docContext}` : ""}
      `,
    }

    // Initialize OpenRouter
    const openrouter = createOpenRouter({
      apiKey: OPENROUTER_API_KEY,
    })

    // Use streamText with OpenRouter's deepseek model
    const result = await streamText({
      model: openrouter("deepseek/deepseek-chat-v3-0324:free"),
      messages: [template, ...messages],
      temperature: 0.7,
    })

    return result.toDataStreamResponse()
  } catch (err) {
    console.log("Error in route handler:", err)
    return new Response("Internal Server Error", { status: 500 })
  }
}
