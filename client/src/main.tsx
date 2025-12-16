import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
import { createBrowserRouter, RouterProvider } from "react-router";
import FormPage from "./screens/FormPage.tsx";
import ResultsPage from "./screens/ResultsPage.tsx";

const router = createBrowserRouter([
  {
    path: "/",
    Component: FormPage,
  },
  {
    path: "/results",
    Component: ResultsPage,
  },
]);

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <RouterProvider router={router} />,
  </StrictMode>,
);
