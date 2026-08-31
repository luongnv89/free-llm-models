import { BrowserRouter, Routes, Route, Link } from "react-router-dom";
import { ROUTER_BASENAME } from "@/lib/site-config";
import { HomePage } from "@/pages/HomePage";
import { ModelDetailPage } from "@/pages/ModelDetailPage";
import { FAQPage } from "@/pages/FAQPage";
import { ArchivePage } from "@/pages/ArchivePage";

function NotFoundPage() {
  return (
    <main className="min-h-screen bg-background p-8 text-center">
      <h1 className="text-2xl font-bold">Page not found</h1>
      <p className="mt-2 text-muted-foreground">
        The requested page does not exist.
      </p>
      <Link
        to="/"
        className="mt-6 inline-block text-[var(--highlight)] underline"
      >
        Back to free models
      </Link>
    </main>
  );
}

function App() {
  return (
    <BrowserRouter basename={ROUTER_BASENAME}>
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/archive" element={<ArchivePage />} />
        <Route path="/model/:modelId" element={<ModelDetailPage />} />
        <Route path="/faq" element={<FAQPage />} />
        <Route path="*" element={<NotFoundPage />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
