import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import App from "./app/App";
import Q1 from "./pages/interview/Q1";

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<App />} />
        <Route path="/interview/q1" element={<Q1 />} />
      </Routes>
    </BrowserRouter>
  </React.StrictMode>
);
