import { DataAPIClient } from "@datastax/astra-db-ts"
import { PuppeteerWebBaseLoader } from "@langchain/community/document_loaders/web/puppeteer"
import { RecursiveCharacterTextSplitter } from "langchain/text_splitter"
import { pipeline } from "@xenova/transformers"

import "dotenv/config"

type SimiliarityMetric = "dot_product" | "cosine" | "euclidean"

const {
  ASTRA_DB_NAMESPACE,
  ASTRA_DB_API_ENDPOINT,
  ASTRA_DB_APPLICATION_TOKEN,
  ASTRA_DB_ST_COLLECTION,
} = process.env

// F1 data sources
const f1Data = ["https://en.wikipedia.org/wiki/Formula_One"]

// Initialize the Astra DB client
const client = new DataAPIClient(ASTRA_DB_APPLICATION_TOKEN)
const db = client.db(ASTRA_DB_API_ENDPOINT, { namespace: ASTRA_DB_NAMESPACE })

// Text splitter for chunking
const splitter = new RecursiveCharacterTextSplitter({
  chunkSize: 512,
  chunkOverlap: 100,
})

// Initialize the embedding model
let embeddingModel = null
const getEmbeddingModel = async () => {
  if (!embeddingModel) {
    console.log("Loading embedding model...")
    embeddingModel = await pipeline(
      "feature-extraction",
      "Xenova/all-MiniLM-L6-v2"
    )
    console.log("Embedding model loaded.")
  }
  return embeddingModel
}

// Create collection with the correct dimensions for sentence-transformers
const createCollection = async (
  similarityMetric: SimiliarityMetric = "cosine"
) => {
  try {
    console.log(`Creating collection: ${ASTRA_DB_ST_COLLECTION}`)
    const res = await db.createCollection(ASTRA_DB_ST_COLLECTION, {
      vector: {
        dimension: 384,
        metric: similarityMetric,
      },
    })
    console.log("Collection created:", res)
  } catch (err) {
    console.error("Error creating collection:", err)
  }
}

const loadSampleData = async () => {
  try {
    const collection = await db.collection(ASTRA_DB_ST_COLLECTION)
    const embedder = await getEmbeddingModel()

    for await (const url of f1Data) {
      console.log(`Scraping data from: ${url}`)
      const content = await scrapePage(url)
      const chunks = await splitter.splitText(content)

      console.log(`Splitting into ${chunks.length} chunks`)

      for (let i = 0; i < chunks.length; i++) {
        const chunk = chunks[i]
        console.log(`Processing chunk ${i + 1}/${chunks.length}`)

        // Generate embedding using sentence-transformers
        const output = await embedder(chunk, {
          pooling: "mean",
          normalize: true,
        })

        // Convert to regular array
        const vector = Array.from(output.data) as number[]

        // Insert into database
        const res = await collection.insertOne({
          $vector: vector,
          text: chunk,
        })

        console.log(`Chunk ${i + 1} inserted:`, res.insertedId)
      }
    }
    console.log("Data loading complete")
  } catch (err) {
    console.error("Error loading data:", err)
  }
}

// Web scraping function
const scrapePage = async (url: string) => {
  console.log(`Scraping page: ${url}`)
  const loader = new PuppeteerWebBaseLoader(url, {
    launchOptions: {
      headless: true,
    },
    gotoOptions: {
      waitUntil: "domcontentloaded",
    },
    evaluate: async (page, browser) => {
      const result = await page.evaluate(() => document.body.innerHTML)
      await browser.close()
      return result
    },
  })

  // Strips out all HTML tags
  const content = (await loader.scrape())?.replace(/<[^>]*>?/gm, "")
  console.log(`Scraped ${content.length} characters`)
  return content
}

// Run the script
const main = async () => {
  try {
    await createCollection()
    await loadSampleData()
  } catch (err) {
    console.error("Error in main function:", err)
  }
}

main()
