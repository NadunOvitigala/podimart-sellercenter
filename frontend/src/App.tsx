import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { AboutPage } from "./pages/AboutPage";
import { AuthProvider } from "./auth";
import { Layout } from "./components/Layout";
import { ConfirmPage } from "./pages/ConfirmPage";
import { ContactPage } from "./pages/ContactPage";
import { DashboardPage } from "./pages/DashboardPage";
import { HomePage } from "./pages/HomePage";
import { LoginPage } from "./pages/LoginPage";
import { ProductFormPage } from "./pages/ProductFormPage";
import { SignupPage } from "./pages/SignupPage";

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route element={<Layout />}>
            <Route path="/" element={<HomePage />} />
            <Route path="/about" element={<AboutPage />} />
            <Route path="/contact" element={<ContactPage />} />
            <Route path="/login" element={<LoginPage />} />
            <Route path="/signup" element={<SignupPage />} />
            <Route path="/confirm" element={<ConfirmPage />} />
            <Route path="/dashboard" element={<DashboardPage />} />
            <Route path="/dashboard/new" element={<ProductFormPage />} />
            <Route path="/dashboard/edit/:id" element={<ProductFormPage />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}
