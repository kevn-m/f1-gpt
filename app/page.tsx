"use client"
import Image from "next/image"
import f1GPTLogo from "./assets/f1gpt-logo.png"
import { useChat } from "ai/react"

import { Message } from "ai"

import Bubble from "./components/Bubble"
import PromptSuggestionsRow from "./components/PromptSuggestionsRow"
import LoadingBubble from "./components/LoadingBubble"

const Home = () => {
  const {
    input,
    handleInputChange,
    handleSubmit,
    append,
    isLoading,
    messages,
  } = useChat()

  const noMessages = !messages || messages.length === 0

  const handlePromptClick = (promptText: string) => {
    const msg: Message = {
      id: crypto.randomUUID(),
      content: promptText,
      role: "user" as const,
    }
    append(msg)
  }

  return (
    <main>
      <Image src={f1GPTLogo} alt="F1GPT Logo" width="250" />
      <section className={noMessages ? "" : "populated"}>
        {noMessages ? (
          <>
            <p>Ask me anything about the F1 season!</p>
            <PromptSuggestionsRow onPromptClick={handlePromptClick} />
            <br />
          </>
        ) : (
          <>
            {messages.map((message, index) => (
              <Bubble key={index} message={message} />
            ))}
            {isLoading && <LoadingBubble />}
          </>
        )}
      </section>
      <form onSubmit={handleSubmit}>
        <input
          className="question-box"
          onChange={handleInputChange}
          value={input}
          placeholder="Ask me something..."
        ></input>
        <input type="submit"></input>
      </form>
    </main>
  )
}

export default Home
