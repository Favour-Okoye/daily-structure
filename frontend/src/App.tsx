import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { HashRouter, Navigate, Route, Routes } from "react-router-dom";
import { AuthProvider } from "./lib/auth";
import { AppShell } from "./components/AppShell";
import { Today } from "./pages/Today";
import { Login } from "./pages/Login";
import { More } from "./pages/More";
import { CrewSoon, TasksSoon, WeekSoon } from "./pages/ComingSoon";

const queryClient = new QueryClient();

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <HashRouter>
          <Routes>
            <Route element={<AppShell />}>
              <Route path="/" element={<Today />} />
              <Route path="/crew" element={<CrewSoon />} />
              <Route path="/tasks" element={<TasksSoon />} />
              <Route path="/week" element={<WeekSoon />} />
              <Route path="/more" element={<More />} />
              <Route path="/login" element={<Login />} />
              <Route path="*" element={<Navigate to="/" replace />} />
            </Route>
          </Routes>
        </HashRouter>
      </AuthProvider>
    </QueryClientProvider>
  );
}
