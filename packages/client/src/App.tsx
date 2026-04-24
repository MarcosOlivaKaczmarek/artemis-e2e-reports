import { Routes, Route } from "react-router-dom";
import { Sidebar } from "./components/Sidebar";
import { Dashboard } from "./pages/dashboard";
import { Runs } from "./pages/runs";
import { RunDetail } from "./pages/run-detail";
import { Flakiness } from "./pages/flakiness";
import { CoverageViewer } from "./pages/coverage-viewer";
import { MonocartViewer } from "./pages/monocart-viewer";

export function App() {
  return (
    <div className="app-layout">
      <Sidebar />
      <main className="app-main">
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/runs" element={<Runs />} />
          <Route path="/runs/:id" element={<RunDetail />} />
          <Route path="/flakiness" element={<Flakiness />} />
          <Route path="/runs/:id/coverage" element={<CoverageViewer />} />
          <Route path="/runs/:id/monocart" element={<MonocartViewer />} />
        </Routes>
      </main>
    </div>
  );
}
