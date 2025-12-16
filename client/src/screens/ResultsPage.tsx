import MainLayout from "../components/MainLayout";

export default function ResultsPage() {
  const queryParams = new URLSearchParams(window.location.search);
  const q = queryParams.get("q");
  const l = queryParams.get("l");
  return (
    <MainLayout>
      <h1 className="text-2xl font-bold">Results Page</h1>
      <p>{q}</p>
      <p>{l}</p>
    </MainLayout>
  );
}
