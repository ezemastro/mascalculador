export default function MainLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="w-screen flex flex-col justify-center items-center">
      {children}
    </div>
  );
}
