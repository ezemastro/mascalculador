import { useEffect, useState } from "react";

type AdminUser = {
  id: number;
  username: string;
  email: string | null;
  is_admin: number;
  created_at: string;
  key_count: number;
};

export default function AdminScreen() {
  const [users, setUsers] = useState<AdminUser[] | null>(null);
  const [error, setError] = useState<string | null>(null);

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

  return (
    <div className="max-w-3xl">
      <h1 className="text-lg font-semibold mb-4">Usuarios registrados</h1>
      {error && <p className="text-xs text-danger">{error}</p>}
      {!users && !error && (
        <p className="text-sm text-text-muted">Cargando...</p>
      )}
      {users && (
        <table className="w-full text-sm text-left border border-border rounded overflow-hidden">
          <thead className="bg-surface text-text-muted">
            <tr>
              <th className="px-3 py-2">Usuario</th>
              <th className="px-3 py-2">Email</th>
              <th className="px-3 py-2">Registrado</th>
              <th className="px-3 py-2">Datos guardados</th>
            </tr>
          </thead>
          <tbody>
            {users.map((u) => (
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
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
