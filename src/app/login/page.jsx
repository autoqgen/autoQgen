export default function LoginPage() {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="p-6 border rounded w-80">
          <h1 className="text-xl font-bold mb-4">Login</h1>
  
          <input className="border p-2 w-full mb-2" placeholder="Email" />
          <input className="border p-2 w-full mb-2" placeholder="Password" />
  
          <button className="bg-blue-500 text-white w-full p-2">
            Login
          </button>
        </div>
      </div>
    );
  }