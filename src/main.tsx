import React from "react"
import ReactDOM from "react-dom/client"
import App from "./App"
import "./index.css"
// 👇 THIS LINE FIXES THE BROKEN/DUPLICATE TEXT
import 'katex/dist/katex.min.css' 

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
)