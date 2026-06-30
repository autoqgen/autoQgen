import { Shield, LogOut } from "lucide-react";
import { signOut } from "next-auth/react";

export default function SecurityLogout() {
  return (
    <div className="bg-white border border-gray-100 rounded-3xl p-6 shadow-sm transition-all hover:shadow-md">
      <div className="flex items-center gap-2 border-b border-gray-50 pb-4 mb-5">
        <Shield size={18} className="text-purple-600" />
        <h2 className="font-bold text-gray-800">Security</h2>
      </div>

      <div className="bg-[#FAF5FF] border border-purple-100/50 rounded-2xl p-5 space-y-4">
        <div className="space-y-1">
          <h3 className="font-bold text-gray-800 text-sm">
            Log Out From All Devices
          </h3>
          <p className="text-xs font-medium text-gray-500 leading-relaxed">
            Log out from all other active sessions and devices for enhanced
            security.
          </p>
        </div>

        <button
          onClick={() => signOut({ callbackUrl: "/auth/login" })}
          className="w-full flex items-center justify-center gap-2 py-3 bg-purple-600 hover:bg-purple-700 text-white font-bold rounded-xl shadow-md shadow-purple-100 hover:shadow-lg transition duration-200 cursor-pointer"
        >
          <LogOut size={16} />
          Log Out
        </button>
      </div>
    </div>
  );
}
