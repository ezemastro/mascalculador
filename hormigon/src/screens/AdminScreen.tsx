import { useEffect, useState } from "react";
import ScreenHeader from "../components/ScreenHeader";
import { flushCloudStorage } from "../lib/cloud-storage.ts";

type AdminUser = {
  id: number;
  username: string;
  email: string | null;
  is_admin: number;
  created_at: string;
  key_count: number;
};

export default function AdminScreen({
  selfUsername,
}: {
  selfUsername: string;
}) {
  const [users, setUsers] = useState<AdminUser[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");

  useEffect(() => {
    fetch("/api/admin/users")
      .then(async (res) => {
        if (!res.ok) throw new Error("No autorizado");
        const data = (await res.json()) as { users: AdminUser[] };
        setUsers(data.users);
      })
      .catch((err: unknown) => {
        setError(err instanceof Error ? err.message : String(err));
      });
  }, []);

  async function handleEnterAs(u: AdminUser) {
    const confirmed = confirm(
      `¿Entrar como "${u.username}"? Vas a ver la app como ese usuario. Para volver, usá el botón "Volver a admin" de la barra superior.`,
    );
    if (!confirmed) return;
    try {
      // Sincroniza lo pendiente del admin ANTES de cambiar de sesión: si no,
      // el beacon de pagehide subiría las keys del admin a la cuenta del
      // usuario suplantado (la navegación ya va con la cookie nueva).
      await flushCloudStorage();
    } catch {
      // seguimos; el debounce reintenta igual
    }
    const res = await fetch("/api/admin/impersonate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId: u.id }),
    });
    if (!res.ok) {
      const data = (await res.json().catch(() => null)) as {
        error?: string;
      } | null;
      alert(data?.error || "No se pudo entrar como ese usuario");
      return;
    }
    window.location.assign("/");
  }

  const q = query.trim().toLowerCase();
  const filtered = users
    ? users.filter(
        (u) =>
          u.username.toLowerCase().includes(q) ||
          (u.email ?? "").toLowerCase().includes(q),
      )
    : null;

  return (
    <div className="max-w-3xl">
      <ScreenHeader
        title="Usuarios registrados"
        subtitle="Módulo interno — administración de cuentas"
      />
      {error && <p className="text-xs text-danger">{error}</p>}
      {!users && !error && (
        <p className="text-sm text-text-muted">Cargando...</p>
      )}
      {users && (
        <div className="mb-3">
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Buscar por usuario o email..."
            aria-label="Buscar por usuario o email"
          />
        </div>
      )}
      {users && (
        <table className="w-full text-sm text-left border border-border rounded overflow-hidden">
          <thead className="bg-surface text-text-muted">
            <tr>
              <th className="px-3 py-2">Usuario</th>
              <th className="px-3 py-2">Email</th>
              <th className="px-3 py-2">Registrado</th>
              <th className="px-3 py-2">Datos guardados</th>
              <th className="px-3 py-2"></th>
            </tr>
          </thead>
          <tbody>
            {filtered && filtered.length === 0 ? (
              <tr>
                <td
                  colSpan={5}
                  className="px-3 py-4 text-center text-text-muted"
                >
                  Sin resultados para “{query}”.
                </td>
              </tr>
            ) : (
              filtered?.map((u) => (
                <tr key={u.id} className="border-t border-border">
                <td className="px-3 py-2">
                  {u.username}
                  {Boolean(u.is_admin) && (
                    <span className="ml-2 text-[10px] bg-primary/20 text-primary px-1.5 py-0.5 rounded">
                      admin
                    </span>
                  )}
                </td>
                <td className="px-3 py-2 text-text-muted">{u.email}</td>
                <td className="px-3 py-2 text-text-muted">
                  {u.created_at.replace("T", " ").slice(0, 10)}
                </td>
                <td className="px-3 py-2">{u.key_count}</td>
                <td className="px-3 py-2 text-right">
                  {u.username !== selfUsername && (
                    <button
                      type="button"
                      onClick={() => void handleEnterAs(u)}
                      className="text-xs text-primary hover:text-primary-hover"
                    >
                      Entrar como...
                    </button>
                  )}
                </td>
              </tr>
              ))
            )}
          </tbody>
        </table>
      )}
    </div>
  );
}
