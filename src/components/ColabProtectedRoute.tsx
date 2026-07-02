import { Navigate, useLocation } from "react-router-dom";

const ColabProtectedRoute = ({ children }: { children: React.ReactNode }) => {
  const token = typeof window !== "undefined" ? localStorage.getItem("promotor_token") : null;
  const location = useLocation();
  if (!token) {
    return <Navigate to="/colaborador/login" replace state={{ from: location.pathname }} />;
  }
  return <>{children}</>;
};

export default ColabProtectedRoute;
