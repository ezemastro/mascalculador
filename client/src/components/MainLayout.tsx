export default function MainLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen w-full flex flex-col items-center py-8 px-4">
      <div className="w-full max-w-4xl flex flex-col gap-8">{children}</div>
    </div>
  );
}
