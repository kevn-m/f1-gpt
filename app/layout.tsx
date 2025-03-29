import "./global.css"
export const metadata = {
  title: "F1GPT",
  description:
    "F1GPT is a chatbot that can answer questions about the F1 season.",
}

const RootLayout = ({ children }) => {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  )
}

export default RootLayout
