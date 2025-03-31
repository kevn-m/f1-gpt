import ReactMarkdown from "react-markdown"
import remarkGfm from "remark-gfm"

const Bubble = ({ message }) => {
  const { content, role } = message
  return (
    <div className={`bubble ${role}`}>
      <ReactMarkdown remarkPlugins={[remarkGfm]}>{content}</ReactMarkdown>
    </div>
  )
}

export default Bubble
