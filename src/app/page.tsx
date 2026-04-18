import Link from "next/link";

export default function Home() {
  return (
    <div>
      {/* Navbar */}
      <nav className="flex justify-between items-center p-4 bg-gray-800 text-white">
        <h1 className="text-xl font-bold">AutoQgen</h1>

        <div className="flex gap-4">
          <Link href="/">Home</Link>
          <Link href="/dashboard">Dashboard</Link>
          <Link href="/dashboard/questions">Questions</Link>
          <Link href="/dashboard/questions/create">Create</Link>
          <Link href="/auth/login">Login</Link>
          <Link href="/auth/signup">Sign Up</Link>
        </div>
      </nav>

      {/* Main Content */}
      <div className="p-10 text-center">
        <h2 className="text-3xl font-bold mb-4">Welcome to AutoQgen 🚀</h2>
        <p className="text-gray-600">smart question bank system</p>
      </div>
    </div>
  );
}
