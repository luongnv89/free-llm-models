import { BrowserRouter, Routes, Route } from "react-router-dom";
import { HomePage } from "@/pages/HomePage";
import { ModelDetailPage } from "@/pages/ModelDetailPage";
import { FAQPage } from "@/pages/FAQPage";
import { ArchivePage } from "@/pages/ArchivePage";

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/archive" element={<ArchivePage />} />
        <Route path="/model/:modelId" element={<ModelDetailPage />} />
        <Route path="/faq" element={<FAQPage />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
