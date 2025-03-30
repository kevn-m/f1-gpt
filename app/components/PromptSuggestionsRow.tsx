import PromptSuggestionButton from "./PromptSuggestionButton"

const PromptSuggestionsRow = ({ onPromptClick }) => {
  const prompts = [
    "Who is Lewis Hamilton?",
    "Who is the current F1 champion?",
    "Why do people even like F1?",
    "How much does each F1 team spend on a car?",
    "Who makes the most money in F1?",
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
