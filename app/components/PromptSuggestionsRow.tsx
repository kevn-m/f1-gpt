import PromptSuggestionButton from "./PromptSuggestionButton"

const PromptSuggestionsRow = ({ onPromptClick }) => {
  const prompts = [
    "What is the current F1 season?",
    "Who is the highest paid F1 driver?",
  ]
  return (
    <div className="prompt-suggestion-row">
      {prompts.map((prompt, index) => (
        <PromptSuggestionButton
          key={`suggestion-${index}`}
          onClick={() => onPromptClick(prompt)}
          text={prompt}
        />
      ))}
    </div>
  )
}

export default PromptSuggestionsRow
