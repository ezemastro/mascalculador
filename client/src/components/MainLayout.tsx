export default function MainLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen w-full flex flex-col items-center py-4 px-4">
      <div className="w-full max-w-7xl flex flex-col gap-8">{children}</div>
    </div>
  );
}
