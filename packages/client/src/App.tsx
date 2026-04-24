import { Routes, Route } from "react-router-dom";
import { Navbar } from "@/components/navbar";
import { Dashboard } from "@/pages/dashboard";
import { RunDetail } from "@/pages/run-detail";
import { CoverageViewer } from "@/pages/coverage-viewer";
import { MonocartViewer } from "@/pages/monocart-viewer";

export function App() {
  return (
    <>
      <Navbar />
      <main className="container mx-auto px-4 py-6">
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/runs/:id" element={<RunDetail />} />
          <Route path="/runs/:id/coverage" element={<CoverageViewer />} />
          <Route path="/runs/:id/monocart" element={<MonocartViewer />} />
        </Routes>
      </main>
    </>
  );
}
