import { User } from "lucide-react";

export default function ProfileSummary({ userDetails }) {
  return (
    <div className="bg-white border border-gray-100 rounded-3xl p-6 shadow-sm transition-all hover:shadow-md">
      <div className="flex items-center gap-2 border-b border-gray-50 pb-4 mb-5">
        <User size={18} className="text-purple-600" />
        <h2 className="font-bold text-gray-800">Profile Summary</h2>
      </div>
      <div className="flex flex-col sm:flex-row items-center gap-5">
        <div className="relative">
          <div className="w-20 h-20 rounded-2xl bg-purple-50 border border-purple-100 flex items-center justify-center text-purple-600 text-3xl font-extrabold shadow-sm">
            {userDetails.name ? userDetails.name.charAt(0).toUpperCase() : "U"}
          </div>
          <span className="absolute bottom-1 right-1 w-3.5 h-3.5 bg-emerald-500 border-2 border-white rounded-full"></span>
        </div>

        <div className="text-center sm:text-left space-y-1">
          <h3 className="text-xl font-bold text-gray-800">{userDetails.name}</h3>
          <p className="text-gray-500 font-medium text-sm">{userDetails.email}</p>
          <p className="text-xs text-gray-400">Member since December 11, 2025</p>
        </div>
      </div>
    </div>
  );
}