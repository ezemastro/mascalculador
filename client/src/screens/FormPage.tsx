import { useState } from "react";
import MainLayout from "../components/MainLayout";
import { useNavigate } from "react-router";

export default function FormPage() {
  const [loads, setLoads] = useState<Load[]>([]);
  const navigate = useNavigate();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    navigate("/results", {
      state: {
        loads,
      },
    });
  };
  return (
    <MainLayout>
      <h1 className="mb-10">Introducir cargas</h1>
      <form className="flex flex-col gap-2" onSubmit={handleSubmit}>
        {loads.map((load) => (
          <div key={load.id} className="flex gap-2 items-center">
            <select
              value={load.type}
              onChange={(e) => {
                const newLoads = [...loads];
                newLoads.find((l) => l.id === load.id)!.type = e.target
                  .value as "point" | "distributed";
                setLoads(newLoads);
              }}
            >
              <option value="point">Carga puntual</option>
              <option value="distributed">Carga distribuida</option>
            </select>
            <input
              type="number"
              placeholder="Magnitud"
              value={load.magnitude || ""}
              onChange={(e) => {
                const newLoads = [...loads];
                newLoads.find((l) => l.id === load.id)!.magnitude = Number(
                  e.target.value,
                );
                setLoads(newLoads);
              }}
            />
            {load.type === "point" ? (
              <input
                type="number"
                placeholder="Posición"
                value={load.position || ""}
                onChange={(e) => {
                  const newLoads = [...loads];
                  newLoads.find((l) => l.id === load.id)!.position = Number(
                    e.target.value,
                  );
                  setLoads(newLoads);
                }}
              />
            ) : (
              <>
                <input
                  type="number"
                  placeholder="Inicio"
                  value={load.start || ""}
                  onChange={(e) => {
                    const newLoads = [...loads];
                    newLoads.find((l) => l.id === load.id)!.start = Number(
                      e.target.value,
                    );
                    setLoads(newLoads);
                  }}
                />
                <input
                  type="number"
                  placeholder="Fin"
                  value={load.end || ""}
                  onChange={(e) => {
                    const newLoads = [...loads];
                    newLoads.find((l) => l.id === load.id)!.end = Number(
                      e.target.value,
                    );
                    setLoads(newLoads);
                  }}
                />
              </>
            )}
          </div>
        ))}
        <button
          type="button"
          onClick={() =>
            setLoads([
              ...loads,
              { id: crypto.randomUUID(), type: "point", magnitude: 0 },
            ])
          }
          className="self-center mt-2"
        >
          Añadir carga
        </button>
        <button type="submit" className="self-center mt-4 px-4 py-2 rounded">
          Calcular
        </button>
      </form>
    </MainLayout>
  );
}
