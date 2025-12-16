import { Form } from "react-router";
import MainLayout from "../components/MainLayout";

export default function FormPage() {
  return (
    <MainLayout>
      <Form action="/results" className="flex flex-col gap-4 items-center">
        <input
          type="text"
          name="q"
          placeholder="q"
          className="outline-2 outline-gray-100 rounded p-2"
        />
        <input
          type="text"
          name="l"
          placeholder="l"
          className="outline-2 outline-gray-100 rounded p-2"
        />
        <button type="submit">Go to Results</button>
      </Form>
    </MainLayout>
  );
}
