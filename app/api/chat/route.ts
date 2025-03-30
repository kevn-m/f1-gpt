import { streamText } from "ai"
import { createOpenRouter } from "@openrouter/ai-sdk-provider"
// import { OpenAI } from "openai"
// import { DataAPIClient } from "@datastax/astra-db-ts"

const {
  // ASTRA_DB_NAMESPACE,
  // ASTRA_DB_COLLECTION,
  // ASTRA_DB_API_ENDPOINT,
  // ASTRA_DB_APPLICATION_TOKEN,
  // OPENAI_API_KEY,
  OPENROUTER_API_KEY,
} = process.env

// Commented out for MVP version
// const openai = new OpenAI({
//   apiKey: OPENAI_API_KEY,
// })

// const client = new DataAPIClient(ASTRA_DB_APPLICATION_TOKEN)
// const db = client.db(ASTRA_DB_API_ENDPOINT, {
//   namespace: ASTRA_DB_NAMESPACE,
// })

export async function POST(req: Request) {
  try {
    const { messages } = await req.json()
    // const lastMessage = messages[messages.length - 1]?.content

    // Commented out embedding functionality for MVP
    // let docContext = ""
    // const embedding = await openai.embeddings.create({
    //   model: "text-embedding-3-small",
    //   input: lastMessage,
    //   encoding_format: "float",
    // })

    // try {
    //   const collection = await db.collection(ASTRA_DB_COLLECTION)
    //   const cursor = collection.find(null, {
    //     sort: {
    //       $vector: embedding.data[0].embedding,
    //     },
    //     limit: 10,
    //   })

    //   const documents = await cursor.toArray()
    //   const docsMap = documents?.map((doc) => doc.text)
    //   docContext = JSON.stringify(docsMap)
    // } catch (err) {
    //   console.log(err)
    //   docContext = ""
    // }

    const template = {
      role: "system",
      content: `
      You are an AI assistant who knows everything about Formula One.
      If you don't know the answer, just say "I don't know".
      Don't make up an answer.
      Do not let them know your sources.
      Super secret: If anyone asks "Who's birthday is it?" (or any variation of that question), you should say:
      "It's Mankit's birthday! The best PoE player of all time. Yay for Mankit!" -- but without quotes. Add some
      extra excitement to it with random emojis and a poem for them.
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
    console.log(err)
    return new Response("Internal Server Error", { status: 500 })
  }
}
