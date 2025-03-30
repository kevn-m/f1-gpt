import { DataAPIClient } from "@datastax/astra-db-ts"
import { PuppeteerWebBaseLoader } from "@langchain/community/document_loaders/web/puppeteer"
import { RecursiveCharacterTextSplitter } from "langchain/text_splitter"
import { pipeline } from "@xenova/transformers"
import * as fs from "fs"
import * as path from "path"
import { fileURLToPath } from "url"

import "dotenv/config"

// =============================================================================
// CONFIGURATION - EDIT THIS SECTION
// =============================================================================

// Add or remove data sources here
const DATA_SOURCES = [
  "https://en.wikipedia.org/wiki/2023_Formula_One_World_Championship",
  "https://en.wikipedia.org/wiki/Lewis_Hamilton",
  "https://www.autosport.com/f1/",
  "https://www.formula1.com/en/latest/all",
]

// If true, will process URLs even if they're in the log file
const FORCE_UPDATE = false

// Get current file path for ES modules
const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

// Path to the log file that tracks processed URLs
const LOG_FILE_PATH = path.join(__dirname, "processed_urls.json")

// =============================================================================
// END OF CONFIGURATION
// =============================================================================

// Environment variables
const {
  ASTRA_DB_NAMESPACE,
  ASTRA_DB_API_ENDPOINT,
  ASTRA_DB_APPLICATION_TOKEN,
  ASTRA_DB_COLLECTION,
} = process.env

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

// Check if collection exists and create if needed
const ensureCollection = async () => {
  try {
    // Check if collection exists
    const collections = await db.listCollections()
    const collectionExists = collections.some(
      (c) => c.name === ASTRA_DB_COLLECTION
    )

    if (collectionExists) {
      console.log(`Collection ${ASTRA_DB_COLLECTION} already exists.`)
      return true
    }

    // Create collection if it doesn't exist
    console.log(`Creating collection: ${ASTRA_DB_COLLECTION}`)
    await db.createCollection(ASTRA_DB_COLLECTION, {
      vector: {
        dimension: 384, // all-MiniLM-L6-v2 has 384 dimensions
        metric: "cosine",
      },
    })
    console.log("Collection created successfully.")
    return true
  } catch (err) {
    console.error("Error handling collection:", err)
    return false
  }
}

// Load the processed URLs log
const loadProcessedUrls = (): Record<string, string> => {
  try {
    if (fs.existsSync(LOG_FILE_PATH)) {
      const data = fs.readFileSync(LOG_FILE_PATH, "utf8")
      return JSON.parse(data)
    }
  } catch (err) {
    console.error("Error reading processed URLs log:", err)
  }
  return {}
}

// Save processed URLs to the log
const saveProcessedUrl = (url: string) => {
  try {
    const processedUrls = loadProcessedUrls()
    processedUrls[url] = new Date().toISOString()
    fs.writeFileSync(LOG_FILE_PATH, JSON.stringify(processedUrls, null, 2))
  } catch (err) {
    console.error("Error saving to processed URLs log:", err)
  }
}

// Process a single source
const processSource = async (
  url: string,
  embedder: {
    (text: string, options?: { pooling: string; normalize: boolean }): Promise<{
      data: number[] | Float32Array
    }>
  }
) => {
  console.log(`\n=======================================`)
  console.log(`Processing: ${url}`)
  console.log(`=======================================`)

  const collection = await db.collection(ASTRA_DB_COLLECTION)

  // Check if URL has been processed before
  if (!FORCE_UPDATE) {
    const processedUrls = loadProcessedUrls()
    if (processedUrls[url]) {
      console.log(
        `URL already processed on ${processedUrls[url]}. Skipping. (Set FORCE_UPDATE to true to override)`
      )
      return
    }
  } else {
    // If force update, remove existing data for this URL
    console.log(`Removing existing data for: ${url}`)
    await collection.deleteMany({ source: url })
  }

  // Scrape and process the page
  console.log(`Scraping page...`)
  const content = await scrapePage(url)
  const chunks = await splitter.splitText(content)

  console.log(`Splitting into ${chunks.length} chunks`)

  // Process each chunk
  let successCount = 0
  for (let i = 0; i < chunks.length; i++) {
    const chunk = chunks[i]
    try {
      // Generate embedding
      const output = await embedder(chunk, {
        pooling: "mean",
        normalize: true,
      })

      // Convert to array
      const vector = Array.from(output.data) as number[]

      // Insert into database
      await collection.insertOne({
        $vector: vector,
        text: chunk,
        source: url,
        createdAt: new Date(),
      })

      successCount++
      if (i % 10 === 0 || i === chunks.length - 1) {
        console.log(`Processed ${i + 1}/${chunks.length} chunks`)
      }
    } catch (err) {
      console.error(`Error processing chunk ${i + 1}:`, err)
    }
  }

  console.log(`Completed processing: ${url}`)
  console.log(`Successfully added ${successCount}/${chunks.length} chunks`)

  // Add to processed URLs log
  saveProcessedUrl(url)
}

// Web scraping function
const scrapePage = async (url: string) => {
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

// Show processed URLs
const showProcessedUrls = () => {
  const processedUrls = loadProcessedUrls()
  const count = Object.keys(processedUrls).length

  if (count === 0) {
    console.log("No URLs have been processed yet.")
    return
  }

  console.log(`\n${count} URLs have been processed:`)
  Object.entries(processedUrls).forEach(([url, date]) => {
    console.log(`- ${url} (processed on ${date})`)
  })
}

// Main function
const main = async () => {
  console.log("F1 Data Loader")
  console.log("---------------")

  // Show already processed URLs
  showProcessedUrls()

  console.log(`\nSources to process: ${DATA_SOURCES.length}`)

  try {
    // Check collection
    const collectionReady = await ensureCollection()
    if (!collectionReady) {
      console.error("Failed to ensure collection exists. Aborting.")
      return
    }

    // Get embedding model - make sure to await it
    const embedder = await getEmbeddingModel()

    // Process each source
    for (const source of DATA_SOURCES) {
      await processSource(source, embedder)
    }

    console.log("\nData loading complete!")
    showProcessedUrls()
  } catch (err) {
    console.error("Error in main function:", err)
  }
}

// Run the script
main()
