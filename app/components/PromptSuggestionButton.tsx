const PromptSuggestionButton = ({ onClick, text }) => {
  return (
    <button onClick={onClick} className="prompt-suggestion-button">
      {text}
    </button>
  )
}

export default PromptSuggestionButton
