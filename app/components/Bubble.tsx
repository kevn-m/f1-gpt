const Bubble = ({ message }) => {
  const { content, role } = message
  return (
    <div className={`bubble ${role}`}>
      <p>{content}</p>
    </div>
  )
}

export default Bubble
