import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import Dashboard from "./pages/Dashboard";
import NovoParecer from "./pages/NovoParecer";
import RevisaoParecer from "./pages/RevisaoParecer";
import Validacao from "./pages/Validacao";
import Resultado from "./pages/Resultado";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/novo" element={<NovoParecer />} />
          <Route path="/revisao/:id" element={<RevisaoParecer />} />
          <Route path="/validacao/:id" element={<Validacao />} />
          <Route path="/resultado/:id" element={<Resultado />} />
          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
